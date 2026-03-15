import { describe, expect, test } from "vitest";

import { buildEpub } from "@/lib/epub";

describe("epub generation", () => {
  test("includes contents and article chapters", async () => {
    const buffer = await buildEpub("2026-03-13", [
      {
        id: "story-1",
        sourceId: "reuters",
        sourceName: "Reuters",
        title: "Markets brace for policy decision",
        url: "https://example.com/story-1",
        publishedAt: "2026-03-13T08:00:00.000Z",
        summary: "A summary",
        categories: ["markets"],
        matchedTerms: ["markets"],
        matchedTopics: ["markets"],
        clusterKey: "markets-brace-for-policy-decision",
        ranking: {
          topicMatch: 1,
          importance: 1,
          freshness: 1,
          sourceReputation: 1,
          clusterStrength: 1,
          feedbackBoost: 0,
          offTopicPenalty: 0,
          diversityPenalty: 0,
          total: 1
        },
        contentHtml: "<p>Long form article body with enough content to create a chapter.</p>",
        plainText: "Long form article body with enough content to create a chapter.",
        extractionKind: "article"
      }
    ]);

    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});
