import { describe, expect, test } from "vitest";

import { isLikelyArticleCandidate } from "@/lib/ingest";

describe("ingest quality filter", () => {
  test("rejects media program pages", () => {
    expect(
      isLikelyArticleCandidate({
        title: "Tech Now",
        url: "https://www.bbc.co.uk/iplayer/episode/m002sx4k?at_medium=RSS&at_campaign=rss",
        summary: "Watch the latest episode now."
      })
    ).toBe(false);
  });

  test("keeps normal article links", () => {
    expect(
      isLikelyArticleCandidate({
        title: "OpenAI launches a cheaper model for enterprise customers",
        url: "https://www.bbc.com/news/articles/example-openai-model",
        summary: "The company announced a new product as competition in AI intensifies."
      })
    ).toBe(true);
  });
});
