import { extract, extractFromHtml } from "@extractus/article-extractor";

import { CandidateArticle, ExtractedArticle } from "@/lib/types";

const ARTICLE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
};
const MIN_FULL_ARTICLE_WORDS = 140;
const MIN_FEED_ARTICLE_WORDS = 220;

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

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function feedQualityPass(text: string, summary: string): boolean {
  const wordCount = countWords(text);
  const summaryWordCount = countWords(summary);
  return (
    wordCount >= MIN_FEED_ARTICLE_WORDS &&
    wordCount >= Math.max(summaryWordCount * 2.2, summaryWordCount + 120)
  );
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
    extractionKind === "feed"
      ? feedQualityPass(plainText, candidate.summary)
      : qualityPass(plainText);
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

export async function extractReadableArticle(
  candidate: CandidateArticle
): Promise<ExtractedArticle | null> {
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
    // Fall through to feed extraction below.
  }

  if (candidate.feedHtml) {
    const feedResult = await extractFromHtml(candidate.feedHtml, candidate.url, {
      contentLengthThreshold: 220
    }).catch(() => null);
    const normalizedFeed = feedResult
      ? normalizeExtractedArticle(candidate, feedResult, "feed")
      : null;

    if (normalizedFeed) {
      return normalizedFeed;
    }
  }

  return null;
}

export async function extractStoryBatch(
  rankedCandidates: CandidateArticle[],
  storyTarget: number
): Promise<ExtractedArticle[]> {
  const extracted: ExtractedArticle[] = [];

  for (const candidate of rankedCandidates) {
    const article = await extractReadableArticle(candidate);
    if (article) {
      extracted.push(article);
    }

    if (extracted.length >= storyTarget) {
      break;
    }
  }

  return extracted;
}
