import { describe, expect, test } from "vitest";

import { DEFAULT_FEEDBACK_MEMORY, DEFAULT_SETTINGS } from "@/lib/defaults";
import { buildPreferenceProfile, pickRelevantSources } from "@/lib/preferences";

describe("preference-driven source selection", () => {
  test("prefers topic-specific feeds over generic ones", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      interests: ["technology", "artificial intelligence"],
      keywords: ["OpenAI", "Claude"]
    };

    const sources = pickRelevantSources(settings, DEFAULT_FEEDBACK_MEMORY);
    const names = sources.map((source) => source.name);

    expect(names).toContain("Reuters Technology");
    expect(names).toContain("BBC Technology");
    expect(names).toContain("New York Times Technology");
  });

  test("builds a profile with expanded topics and no empty terms", () => {
    const profile = buildPreferenceProfile(DEFAULT_SETTINGS, DEFAULT_FEEDBACK_MEMORY);

    expect(profile.desiredTopics).toContain("technology");
    expect(profile.coreTerms).toContain("technology");
    expect(profile.expansionTerms.length).toBeGreaterThan(0);
  });

  test("does not prioritize world feeds from contextual keywords alone", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      interests: ["technology", "artificial intelligence", "markets"],
      keywords: ["OpenAI", "war", "Trump"]
    };

    const sources = pickRelevantSources(settings, DEFAULT_FEEDBACK_MEMORY);
    const names = sources.map((source) => source.name);

    expect(names.slice(0, 4)).not.toContain("Reuters World");
    expect(names.slice(0, 4)).not.toContain("BBC World");
    expect(names).toContain("Reuters Technology");
    expect(names).toContain("Reuters Business");
  });
});
