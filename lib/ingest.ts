import Parser from "rss-parser";

import { DEFAULT_FEEDBACK_MEMORY } from "@/lib/defaults";
import { pickRelevantSources } from "@/lib/preferences";
import { RawIngestedArticle } from "@/lib/ranking";
import { DigestSettings, FeedbackMemory } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { RecencyMode, isWithinAllowedDigestDates } from "@/lib/time";

const parser = new Parser();
const BLOCKED_URL_PATTERNS = [
  "/iplayer/",
  "/sounds/",
  "/programmes/",
  "/podcasts/",
  "/audio/",
  "/videos/",
  "/video/",
  "/live/",
  "/live-",
  "/av/",
  "/commentisfree/",
  "/interactive/",
  "/ng-interactive/",
  "/newsletter/"
];
const BLOCKED_TITLE_PATTERNS = [
  /^tech now$/i,
  /^newsday$/i,
  /^business daily$/i,
  /^world business report$/i,
  /^click$/i,
  /^hardtalk$/i,
  /^here'?s what happened /i,
  /\blive updates?\b/i,
  /\brecap\b/i
];

function toSafeString(input: unknown, fallback = ""): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (typeof record["#text"] === "string") {
      return record["#text"];
    }

    if (typeof record.text === "string") {
      return record.text;
    }
  }

  return fallback;
}

function cleanSummary(input: unknown): string {
  return toSafeString(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFeedHtml(item: Record<string, unknown>): string | undefined {
  const html = toSafeString(
    item["content:encoded"],
    toSafeString(item.content, toSafeString(item.summary))
  ).trim();

  if (!html || html.length < 120) {
    return undefined;
  }

  return html;
}

export function isLikelyArticleCandidate(input: {
  title: string;
  url: string;
  summary: string;
}): boolean {
  const normalizedTitle = input.title.trim().toLowerCase();
  const normalizedUrl = input.url.trim().toLowerCase();
  const wordCount = normalizedTitle.split(/\s+/).filter(Boolean).length;

  if (!normalizedUrl.startsWith("http")) {
    return false;
  }

  if (BLOCKED_URL_PATTERNS.some((pattern) => normalizedUrl.includes(pattern))) {
    return false;
  }

  if (BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle))) {
    return false;
  }

  if (wordCount <= 2 && input.summary.trim().length < 140) {
    return false;
  }

  return true;
}

export async function fetchCandidateArticles(
  settings: DigestSettings,
  feedbackMemory: FeedbackMemory = DEFAULT_FEEDBACK_MEMORY,
  recencyMode: RecencyMode = "previous-only"
): Promise<RawIngestedArticle[]> {
  const sources = pickRelevantSources(settings, feedbackMemory);

  const feeds = await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.rssUrl);
        return feed.items.map((item) => ({
          title: toSafeString(item.title, "Untitled story").trim() || "Untitled story",
          url: toSafeString(item.link, source.homepage).trim() || source.homepage,
          publishedAt:
            toSafeString(item.isoDate, toSafeString(item.pubDate, new Date().toISOString())) ||
            new Date().toISOString(),
          summary: cleanSummary(item.contentSnippet ?? item.content ?? item.summary),
          feedHtml: extractFeedHtml(item as Record<string, unknown>),
          categories: Array.isArray(item.categories)
            ? item.categories.map((category) => toSafeString(category)).filter(Boolean)
            : [],
          source,
          imageUrl: undefined
        }));
      } catch {
        return [];
      }
    })
  );

  return feeds
    .flat()
    .filter((item) =>
      isLikelyArticleCandidate({
        title: item.title,
        url: item.url,
        summary: item.summary
      })
    )
    .filter((item) =>
      isWithinAllowedDigestDates(
        new Date(item.publishedAt).toISOString(),
        settings.timezone,
        recencyMode
      )
    )
    .map((item) => ({
      ...item,
      title: item.title,
      summary: item.summary || slugify(item.title).replace(/-/g, " ")
    }));
}
