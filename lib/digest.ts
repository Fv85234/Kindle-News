import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";

import { buildEpub } from "@/lib/epub";
import { sendEditionEmail } from "@/lib/email";
import { extractStoryBatch } from "@/lib/extract";
import { fetchCandidateArticles } from "@/lib/ingest";
import { rerankWithOpenAI } from "@/lib/openai";
import { scoreCandidates, selectTopStories } from "@/lib/ranking";
import { appendEdition, persistEditionBinary, readAppData } from "@/lib/storage";
import { RecencyMode, getEditionWindow } from "@/lib/time";
import { CandidateArticle, EditionRecord } from "@/lib/types";
import { toErrorMessage } from "@/lib/errors";
import { extractImportantTokens } from "@/lib/preferences";
import { slugify } from "@/lib/utils";

type RunDailyDigestOptions = {
  force?: boolean;
  recencyMode?: RecencyMode;
  mode?: "manual" | "scheduled";
};
const MINIMUM_DELIVERY_STORIES = 3;
const MINIMUM_FULL_ARTICLES = 3;
const EXTRACTION_POOL_MULTIPLIER = 14;
const EXTRACTION_POOL_MINIMUM = 120;

function storyHistoryKey(title: string): string {
  const tokens = extractImportantTokens(title).slice(0, 6).sort();
  return slugify(tokens.join(" ")) || slugify(title);
}

export function excludePreviouslySentArticles(
  articles: Awaited<ReturnType<typeof fetchCandidateArticles>>,
  deliveryHistory: EditionRecord[]
) {
  const sentStories = deliveryHistory.filter(
    (edition) => edition.status === "sent" && edition.mode === "scheduled"
  );
  const seenUrls = new Set(
    sentStories.flatMap((edition) => edition.stories.map((story) => story.url))
  );
  const seenKeys = new Set(
    sentStories.flatMap((edition) =>
      edition.stories.map((story) => storyHistoryKey(story.title))
    )
  );

  return articles.filter(
    (article) =>
      !seenUrls.has(article.url) && !seenKeys.has(storyHistoryKey(article.title))
  );
}

export function buildExtractionPool(
  candidates: CandidateArticle[],
  storyTarget: number
): CandidateArticle[] {
  const preferred = selectTopStories(
    candidates,
    Math.max(storyTarget * 6, 60)
  );
  const selectedIds = new Set(preferred.map((candidate) => candidate.id));
  const recoveryPool = candidates.filter(
    (candidate) =>
      !selectedIds.has(candidate.id) &&
      (candidate.matchedTerms.length > 0 || candidate.ranking.topicMatch >= 0.45)
  );

  return [...preferred, ...recoveryPool].slice(
    0,
    Math.max(storyTarget * EXTRACTION_POOL_MULTIPLIER, EXTRACTION_POOL_MINIMUM)
  );
}

export async function runDailyDigest(
  options: RunDailyDigestOptions = {}
): Promise<EditionRecord> {
  const data = await readAppData();
  const { settings, deliveryHistory, feedbackMemory } = data;
  const window = getEditionWindow(settings.timezone);
  const recencyMode = options.recencyMode ?? "previous-only";
  const mode = options.mode ?? "scheduled";

  const fail = async (reason: string, candidateCount = 0): Promise<EditionRecord> => {
    const failed: EditionRecord = {
      id: randomUUID(),
      editionDate: window.editionDate,
      createdAt: new Date().toISOString(),
      status: "failed",
      mode,
      reason,
      candidateCount,
      selectedCount: 0,
      stories: []
    };
    await appendEdition(failed);
    return failed;
  };

  if (!settings.kindleEmail || !settings.senderEmail) {
    return fail("Kindle recipient and sender email must be configured.");
  }

  const existing = deliveryHistory.find(
    (edition) =>
      edition.editionDate === window.editionDate &&
      edition.status === "sent" &&
      edition.mode === "scheduled"
  );
  if (existing && !options.force) {
    return existing;
  }

  try {
    const ingested = await fetchCandidateArticles(
      settings,
      feedbackMemory,
      recencyMode
    );
    if (ingested.length === 0) {
      return fail(
        recencyMode === "previous-or-current"
          ? "No candidate articles were found for today or yesterday."
          : "No candidate articles were found for the previous day."
      );
    }
    const unseenCandidates = excludePreviouslySentArticles(ingested, deliveryHistory);
    if (unseenCandidates.length === 0) {
      return fail("All matching stories were already sent in a previous edition.");
    }

    const heuristicRanked = scoreCandidates(unseenCandidates, settings, feedbackMemory);
    const aiRanked = await rerankWithOpenAI(
      heuristicRanked,
      settings,
      feedbackMemory
    );
    const extractionPool = buildExtractionPool(aiRanked, settings.storyTarget);
    if (extractionPool.length === 0) {
      return fail(
        "No unseen articles matched your interests strongly enough.",
        unseenCandidates.length
      );
    }

    const extracted = await extractStoryBatch(
      extractionPool,
      settings.storyTarget
    );

    if (extracted.length === 0) {
      return fail(
        `Could not extract readable content from ${extractionPool.length} relevant unseen articles.`,
        unseenCandidates.length
      );
    }

  if (extracted.length < MINIMUM_DELIVERY_STORIES) {
      return fail(
        `Only found ${extracted.length} high-quality unseen articles, so the digest was not sent.`,
        unseenCandidates.length
      );
    }

    const fullArticleCount = extracted.filter(
      (story) => story.extractionKind !== "summary"
    ).length;
    if (fullArticleCount < MINIMUM_FULL_ARTICLES) {
      return fail(
        `Only found ${fullArticleCount} full articles. The rest would have been summaries, so the digest was not sent.`,
        unseenCandidates.length
      );
    }

    const epub = await buildEpub(window.editionDate, extracted);
    const epubPath = await persistEditionBinary(
      `kindle-news-${window.editionDate}.epub`,
      epub
    );

    await sendEditionEmail({
      editionDate: window.editionDate,
      recipientEmail: settings.kindleEmail,
      senderEmail: settings.senderEmail,
      epub
    });

    const record: EditionRecord = {
      id: randomUUID(),
      editionDate: window.editionDate,
      createdAt: new Date().toISOString(),
      status: "sent",
      mode,
      candidateCount: heuristicRanked.length,
      selectedCount: extracted.length,
      deliveredTo: settings.kindleEmail,
      epubPath,
      stories: extracted.map((story) => ({
        title: story.title,
        url: story.url,
        sourceName: story.sourceName,
        categories: story.categories,
        matchedTerms: story.matchedTerms
      }))
    };

    await appendEdition(record);
    return record;
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export function shouldRunDigestNow(
  timezone: string,
  deliveryHour: number,
  now = DateTime.now()
): boolean {
  const localNow = now.setZone(timezone);
  return localNow.hour === deliveryHour;
}
