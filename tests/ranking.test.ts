import { describe, expect, test } from "vitest";

import { DEFAULT_SETTINGS, REPUTABLE_SOURCES } from "@/lib/defaults";
import { scoreCandidates, selectTopStories } from "@/lib/ranking";

describe("ranking", () => {
  test("prefers topic-aligned articles and deduplicates clusters", () => {
    const source = REPUTABLE_SOURCES[0];
    const candidates = scoreCandidates(
      [
        {
          title: "AI regulation advances across Europe after major policy vote",
          url: "https://example.com/1",
          publishedAt: new Date().toISOString(),
          summary: "Artificial intelligence policy and european regulators dominate the agenda.",
          categories: ["technology", "policy"],
          source
        },
        {
          title: "AI regulation advances across Europe after major policy vote analysts react",
          url: "https://example.com/2",
          publishedAt: new Date().toISOString(),
          summary: "A duplicate framing of the same story.",
          categories: ["technology", "policy"],
          source
        },
        {
          title: "Celebrity dinner recap",
          url: "https://example.com/3",
          publishedAt: new Date().toISOString(),
          summary: "Gossip coverage.",
          categories: ["entertainment"],
          source
        }
      ],
      DEFAULT_SETTINGS
    );

    const selected = selectTopStories(candidates, 10);
    expect(selected.some((story) => story.title.includes("analysts react"))).toBe(false);
    expect(selected[0]?.title).toContain("AI regulation");
  });

  test("does not keep generic world stories just because the feed is broad", () => {
    const candidates = scoreCandidates(
      [
        {
          title: "OpenAI unveils new enterprise model for developers",
          url: "https://example.com/openai",
          publishedAt: new Date().toISOString(),
          summary: "OpenAI and artificial intelligence product launch aimed at enterprise teams.",
          categories: ["technology", "artificial intelligence"],
          source: REPUTABLE_SOURCES[0]
        },
        {
          title: "Police investigate local crime ring after overnight raid",
          url: "https://example.com/crime",
          publishedAt: new Date().toISOString(),
          summary: "Authorities made arrests after a long investigation.",
          categories: ["world"],
          source: REPUTABLE_SOURCES.find((source) => source.id === "bbc-world") ?? REPUTABLE_SOURCES[0]
        }
      ],
      {
        ...DEFAULT_SETTINGS,
        interests: ["technology", "artificial intelligence"],
        keywords: ["OpenAI", "Claude"]
      }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toContain("OpenAI");
  });

  test("keeps topic and source diversity when one broad keyword dominates", () => {
    const nytWorld = REPUTABLE_SOURCES.find((source) => source.id === "nytimes-world") ?? REPUTABLE_SOURCES[0];
    const nytTech = REPUTABLE_SOURCES.find((source) => source.id === "nytimes-tech") ?? REPUTABLE_SOURCES[0];
    const reutersTech = REPUTABLE_SOURCES.find((source) => source.id === "reuters-tech") ?? REPUTABLE_SOURCES[0];
    const settings = {
      ...DEFAULT_SETTINGS,
      interests: ["technology", "artificial intelligence", "markets"],
      keywords: ["OpenAI", "war", "markets"]
    };

    const candidates = scoreCandidates(
      [
        {
          title: "War in the region threatens oil shipping routes",
          url: "https://example.com/war-1",
          publishedAt: new Date().toISOString(),
          summary: "A geopolitics update about the war and shipping routes.",
          categories: ["world"],
          source: nytWorld
        },
        {
          title: "Another war update as strikes intensify overnight",
          url: "https://example.com/war-2",
          publishedAt: new Date().toISOString(),
          summary: "Another broad war update with little technology relevance.",
          categories: ["world"],
          source: nytWorld
        },
        {
          title: "OpenAI launches coding agents for enterprise teams",
          url: "https://example.com/openai-1",
          publishedAt: new Date().toISOString(),
          summary: "OpenAI expands its artificial intelligence product lineup for companies.",
          categories: ["technology"],
          source: nytTech
        },
        {
          title: "Chip stocks rise as AI infrastructure spending accelerates",
          url: "https://example.com/markets-1",
          publishedAt: new Date().toISOString(),
          summary: "Markets rally around semiconductor and AI infrastructure demand.",
          categories: ["markets", "technology"],
          source: reutersTech
        }
      ],
      settings
    );

    const selected = selectTopStories(candidates, 3);

    expect(selected.some((story) => story.title.includes("OpenAI"))).toBe(true);
    expect(selected.some((story) => story.title.includes("Chip stocks"))).toBe(true);
    expect(selected.filter((story) => story.sourceId === nytWorld.id).length).toBeLessThanOrEqual(1);
  });

  test("rejects context-only geopolitics stories when stronger interests exist", () => {
    const nytWorld = REPUTABLE_SOURCES.find((source) => source.id === "nytimes-world") ?? REPUTABLE_SOURCES[0];
    const reutersBusiness =
      REPUTABLE_SOURCES.find((source) => source.id === "reuters-business") ?? REPUTABLE_SOURCES[0];
    const settings = {
      ...DEFAULT_SETTINGS,
      interests: ["technology", "artificial intelligence", "S&P 500"],
      keywords: ["OpenAI", "markets", "war", "Trump"]
    };

    const candidates = scoreCandidates(
      [
        {
          title: "War intensifies as overnight strikes continue",
          url: "https://example.com/war-only",
          publishedAt: new Date().toISOString(),
          summary: "A broad geopolitics update about the war and diplomatic fallout.",
          categories: ["world"],
          source: nytWorld
        },
        {
          title: "S&P 500 rises as OpenAI spending lifts chip and cloud shares",
          url: "https://example.com/ai-markets",
          publishedAt: new Date().toISOString(),
          summary: "Markets rally as investors price in new artificial intelligence demand.",
          categories: ["markets", "technology"],
          source: reutersBusiness
        }
      ],
      settings
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toContain("S&P 500 rises");
  });
});
