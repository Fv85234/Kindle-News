import { extract, extractFromHtml } from "@extractus/article-extractor";

import { CandidateArticle, ExtractedArticle } from "@/lib/types";

const ARTICLE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
};
const MIN_FULL_ARTICLE_WORDS = 140;
const MIN_FEED_ARTICLE_WORDS = 120;
const MAX_SUMMARY_FALLBACKS = 2;

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function qualityPass(text: string): boolean {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return wordCount >= MIN_FULL_ARTICLE_WORDS;
}

function feedQualityPass(text: string): boolean {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return wordCount >= MIN_FEED_ARTICLE_WORDS;
}

function normalizeExtractedArticle(
  candidate: CandidateArticle,
  article: { content?: string | null; author?: string | null },
  extractionKind: ExtractedArticle["extractionKind"]
): ExtractedArticle | null {
  const contentHtml = article.content?.trim() ?? "";
  const plainText = htmlToText(contentHtml);

  if (!contentHtml) {
    return null;
  }

  const passes =
    extractionKind === "feed" ? feedQualityPass(plainText) : qualityPass(plainText);
  if (!passes) {
    return null;
  }

  return {
    ...candidate,
    author: article.author || undefined,
    contentHtml,
    plainText,
    extractionKind
  };
}

function buildSummaryFallback(candidate: CandidateArticle): ExtractedArticle | null {
  const summary = candidate.summary.trim();
  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) {
    return null;
  }

  const safeSummary = escapeHtml(summary);
  const contentHtml = `
    <p class="summary-fallback">Full article extraction was unavailable, so this section uses the source summary.</p>
    <p>${safeSummary}</p>
  `;

  return {
    ...candidate,
    contentHtml,
    plainText: summary,
    extractionKind: "summary"
  };
}

export async function extractReadableArticle(
  candidate: CandidateArticle
): Promise<ExtractedArticle | null> {
  if (candidate.feedHtml) {
    const feedResult = await extractFromHtml(candidate.feedHtml, candidate.url, {
      contentLengthThreshold: 120
    }).catch(() => null);
    const normalizedFeed = feedResult
      ? normalizeExtractedArticle(candidate, feedResult, "feed")
      : null;

    if (normalizedFeed) {
      return normalizedFeed;
    }
  }

  try {
    const result = await extract(
      candidate.url,
      {
        contentLengthThreshold: 140
      },
      {
        headers: ARTICLE_HEADERS
      }
    );
    const normalized = result
      ? normalizeExtractedArticle(candidate, result, "article")
      : null;

    if (normalized) {
      return normalized;
    }
  } catch {
    // Fall through to summary fallback below.
  }

  return buildSummaryFallback(candidate);
}

export async function extractStoryBatch(
  rankedCandidates: CandidateArticle[],
  storyTarget: number
): Promise<ExtractedArticle[]> {
  const extracted: ExtractedArticle[] = [];
  const summaryFallbacks: ExtractedArticle[] = [];

  for (const candidate of rankedCandidates) {
    const article = await extractReadableArticle(candidate);
    if (article && article.extractionKind !== "summary") {
      extracted.push(article);
    } else if (
      article &&
      article.extractionKind === "summary" &&
      summaryFallbacks.length < MAX_SUMMARY_FALLBACKS
    ) {
      summaryFallbacks.push(article);
    }

    if (extracted.length >= storyTarget) {
      break;
    }
  }

  return [...extracted, ...summaryFallbacks].slice(0, storyTarget);
}
