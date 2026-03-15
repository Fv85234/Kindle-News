import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@extractus/article-extractor", () => ({
  extract: vi.fn(),
  extractFromHtml: vi.fn()
}));

import { extract, extractFromHtml } from "@extractus/article-extractor";

import { REPUTABLE_SOURCES } from "@/lib/defaults";
import { extractReadableArticle } from "@/lib/extract";

describe("extract fallback", () => {
  beforeEach(() => {
    vi.mocked(extract).mockReset();
    vi.mocked(extractFromHtml).mockReset();
  });

  test("uses the feed summary when full extraction fails but summary is still useful", async () => {
    vi.mocked(extract).mockRejectedValueOnce(new Error("blocked"));

    const article = await extractReadableArticle({
      id: "candidate-1",
      sourceId: REPUTABLE_SOURCES[0].id,
      sourceName: REPUTABLE_SOURCES[0].name,
      title: "OpenAI launches a cheaper model",
      url: "https://example.com/openai-cheaper-model",
      publishedAt: new Date().toISOString(),
      summary:
        "OpenAI unveiled a cheaper model for developers as price competition across AI tools intensifies.",
      categories: ["technology"],
      matchedTerms: ["openai", "ai"],
      matchedTopics: ["artificial intelligence", "technology"],
      clusterKey: "openai-cheaper-model",
      ranking: {
        topicMatch: 0.9,
        importance: 0.8,
        freshness: 0.9,
        sourceReputation: 0.95,
        clusterStrength: 0.4,
        feedbackBoost: 0,
        offTopicPenalty: 0,
        diversityPenalty: 0,
        total: 0.87
      }
    });

    expect(article).not.toBeNull();
    expect(article?.contentHtml).toContain("source summary");
    expect(article?.plainText).toContain("cheaper model");
  });
});
