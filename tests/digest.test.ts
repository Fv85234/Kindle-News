import { describe, expect, test } from "vitest";

import { buildExtractionPool, excludePreviouslySentArticles } from "@/lib/digest";
import { REPUTABLE_SOURCES } from "@/lib/defaults";

describe("digest dedupe", () => {
  test("excludes stories that were already sent in past editions", () => {
    const candidates = [
      {
        title: "OpenAI launches a new model for developers",
        url: "https://example.com/openai-new",
        publishedAt: new Date().toISOString(),
        summary: "A new launch.",
        categories: ["technology"],
        source: REPUTABLE_SOURCES[0]
      },
      {
        title: "Markets react to central bank policy shift",
        url: "https://example.com/markets-new",
        publishedAt: new Date().toISOString(),
        summary: "A new market story.",
        categories: ["markets"],
        source: REPUTABLE_SOURCES[1]
      }
    ];

    const filtered = excludePreviouslySentArticles(candidates, [
      {
        id: "edition-1",
        editionDate: "2026-03-13",
        createdAt: new Date().toISOString(),
        status: "sent",
        mode: "scheduled",
        candidateCount: 2,
        selectedCount: 1,
        stories: [
          {
            title: "OpenAI launches a new model for developers",
            url: "https://example.com/openai-new",
            sourceName: "Reuters Technology",
            categories: ["technology"],
            matchedTerms: ["openai"]
          }
        ]
      }
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toContain("Markets react");
  });

  test("builds a wider extraction pool when shortlist is too narrow", () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      id: `candidate-${index + 1}`,
      sourceId: REPUTABLE_SOURCES[index % 2].id,
      sourceName: REPUTABLE_SOURCES[index % 2].name,
      title:
        index < 3
          ? "OpenAI launches a new model for developers"
          : `AI chipmakers face pricing pressure ${index + 1}`,
      url: `https://example.com/story-${index + 1}`,
      publishedAt: new Date().toISOString(),
      summary: "A substantive summary about technology markets and artificial intelligence.",
      categories: ["technology"],
      matchedTerms: ["openai", "markets"],
      matchedTopics: ["artificial intelligence", "markets"],
      clusterKey: index < 3 ? "openai-launch" : `cluster-${index + 1}`,
      ranking: {
        topicMatch: 0.9,
        importance: 0.8,
        freshness: 0.9,
        sourceReputation: 0.95,
        clusterStrength: 0.4,
        feedbackBoost: 0,
        offTopicPenalty: 0,
        diversityPenalty: 0,
        total: 0.8 - index * 0.02
      }
    }));

    const pool = buildExtractionPool(candidates, 4);

    expect(pool.length).toBe(candidates.length);
    expect(new Set(pool.map((candidate) => candidate.id)).size).toBe(candidates.length);
  });
});
