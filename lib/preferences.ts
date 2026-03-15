import { DEFAULT_FEEDBACK_MEMORY, REPUTABLE_SOURCES } from "@/lib/defaults";
import { DigestSettings, FeedbackMemory, NewsSource } from "@/lib/types";
import { normalizeTokens, uniqueBy } from "@/lib/utils";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "to",
  "with"
]);

export const TOPIC_KEYWORDS: Record<string, string[]> = {
  technology: [
    "technology",
    "tech",
    "software",
    "hardware",
    "startup",
    "startups",
    "chip",
    "chips",
    "semiconductor",
    "platform"
  ],
  "artificial intelligence": [
    "artificial intelligence",
    "ai",
    "machine learning",
    "llm",
    "chatgpt",
    "openai",
    "anthropic",
    "claude",
    "gemini",
    "model"
  ],
  economics: [
    "economics",
    "economy",
    "economic",
    "inflation",
    "gdp",
    "rates",
    "fed",
    "ecb",
    "tariff",
    "trade"
  ],
  markets: [
    "markets",
    "market",
    "stocks",
    "shares",
    "equities",
    "bonds",
    "investors",
    "earnings",
    "nasdaq",
    "s&p"
  ],
  policy: [
    "policy",
    "regulation",
    "regulatory",
    "antitrust",
    "bill",
    "law",
    "lawsuit",
    "court",
    "judge",
    "probe"
  ],
  politics: [
    "politics",
    "election",
    "government",
    "white house",
    "president",
    "parliament",
    "congress",
    "trump",
    "biden"
  ],
  world: [
    "world",
    "global",
    "international",
    "geopolitics",
    "conflict",
    "sanctions",
    "diplomacy",
    "summit"
  ],
  war: [
    "war",
    "military",
    "missile",
    "drone",
    "troops",
    "ceasefire",
    "frontline",
    "defence",
    "defense"
  ],
  europe: [
    "europe",
    "european",
    "eu",
    "brussels",
    "germany",
    "france",
    "spain",
    "italy",
    "uk",
    "ukraine"
  ],
  companies: [
    "company",
    "companies",
    "ceo",
    "acquisition",
    "merger",
    "earnings",
    "revenue",
    "ipo"
  ]
};

export const CONTEXTUAL_TOPICS = ["world", "politics", "war"] as const;

const CONTEXTUAL_TERMS = new Set([
  "war",
  "trump",
  "biden",
  "president",
  "politics",
  "political",
  "government",
  "congress",
  "parliament",
  "military",
  "missile",
  "troops",
  "ceasefire",
  "sanctions",
  "diplomacy",
  "conflict"
]);

export type PreferenceProfile = {
  interestTerms: string[];
  keywordTerms: string[];
  anchorKeywordTerms: string[];
  contextualKeywordTerms: string[];
  coreTerms: string[];
  expansionTerms: string[];
  avoidTerms: string[];
  interestTopics: string[];
  keywordTopics: string[];
  anchorKeywordTopics: string[];
  contextualKeywordTopics: string[];
  desiredTopics: string[];
  sourceScores: Record<string, number>;
  termScores: Record<string, number>;
  topicScores: Record<string, number>;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function extractImportantTokens(text: string): string[] {
  return uniqueBy(
    text
      .toLowerCase()
      .split(/[^a-z0-9+.#]+/i)
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token.length >= 3 || ["ai", "eu", "uk"].includes(token))
      .filter((token) => !STOP_WORDS.has(token)),
    (token) => token
  );
}

function termAppears(text: string, term: string): boolean {
  if (!term) {
    return false;
  }

  if (term.includes(" ")) {
    return text.includes(term);
  }

  if (term.length <= 3) {
    return new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, "i").test(text);
  }

  return text.includes(term);
}

function topScoredEntries(
  scores: Record<string, number>,
  direction: "positive" | "negative",
  limit: number
): string[] {
  const filtered = Object.entries(scores).filter(([, value]) =>
    direction === "positive" ? value > 0 : value < 0
  );

  return filtered
    .sort((left, right) =>
      direction === "positive" ? right[1] - left[1] : left[1] - right[1]
    )
    .slice(0, limit)
    .map(([key]) => key);
}

export function inferDesiredTopics(terms: string[]): string[] {
  const normalized = normalizeTokens(terms);
  const matchedTopics = Object.entries(TOPIC_KEYWORDS)
    .filter(([topic, keywords]) =>
      normalized.some(
        (term) =>
          term === topic ||
          keywords.some((keyword) => term.includes(keyword) || keyword.includes(term))
      )
    )
    .map(([topic]) => topic);

  return uniqueBy(matchedTopics, (topic) => topic);
}

export function isContextualTopic(topic: string): boolean {
  return CONTEXTUAL_TOPICS.includes(topic as (typeof CONTEXTUAL_TOPICS)[number]);
}

export function isContextualTerm(term: string): boolean {
  const normalized = normalizeTokens([term])[0];
  if (!normalized) {
    return false;
  }

  if (CONTEXTUAL_TERMS.has(normalized)) {
    return true;
  }

  const inferredTopics = inferDesiredTopics([normalized]);
  return inferredTopics.length > 0 && inferredTopics.every((topic) => isContextualTopic(topic));
}

export function buildPreferenceProfile(
  settings: DigestSettings,
  feedbackMemory: FeedbackMemory = DEFAULT_FEEDBACK_MEMORY
): PreferenceProfile {
  const interestTerms = normalizeTokens(settings.interests);
  const keywordTerms = normalizeTokens(settings.keywords);
  const anchorKeywordTerms = keywordTerms.filter((term) => !isContextualTerm(term));
  const contextualKeywordTerms = keywordTerms.filter((term) => isContextualTerm(term));
  const rawTerms = [...interestTerms, ...keywordTerms];
  const interestTopics = inferDesiredTopics(interestTerms);
  const keywordTopics = inferDesiredTopics(keywordTerms);
  const anchorKeywordTopics = keywordTopics.filter((topic) => !isContextualTopic(topic));
  const contextualKeywordTopics = keywordTopics.filter((topic) => isContextualTopic(topic));
  const desiredTopics = uniqueBy([...interestTopics, ...keywordTopics], (topic) => topic);
  const topicExpansions = desiredTopics.flatMap((topic) => TOPIC_KEYWORDS[topic] ?? []);
  const positiveTerms = topScoredEntries(feedbackMemory.termScores, "positive", 12);
  const negativeTerms = topScoredEntries(feedbackMemory.termScores, "negative", 12);
  const dislikedTopics = topScoredEntries(feedbackMemory.topicScores, "negative", 6);

  return {
    interestTerms: uniqueBy(interestTerms, (term) => term),
    keywordTerms: uniqueBy(keywordTerms, (term) => term),
    anchorKeywordTerms: uniqueBy(anchorKeywordTerms, (term) => term),
    contextualKeywordTerms: uniqueBy(contextualKeywordTerms, (term) => term),
    coreTerms: uniqueBy(rawTerms, (term) => term),
    expansionTerms: uniqueBy([...topicExpansions, ...positiveTerms], (term) => term),
    avoidTerms: uniqueBy(
      normalizeTokens([...settings.exclusions, ...negativeTerms, ...dislikedTopics]),
      (term) => term
    ),
    interestTopics,
    keywordTopics,
    anchorKeywordTopics,
    contextualKeywordTopics,
    desiredTopics,
    sourceScores: feedbackMemory.sourceScores,
    termScores: feedbackMemory.termScores,
    topicScores: feedbackMemory.topicScores
  };
}

export function detectTopicsInText(text: string): string[] {
  const normalized = text.toLowerCase();
  const topics = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => termAppears(normalized, keyword)))
    .map(([topic]) => topic);

  return uniqueBy(topics, (topic) => topic);
}

export function pickRelevantSources(
  settings: DigestSettings,
  feedbackMemory: FeedbackMemory = DEFAULT_FEEDBACK_MEMORY
): NewsSource[] {
  const profile = buildPreferenceProfile(settings, feedbackMemory);
  const preferredRegions = new Set(normalizeTokens(settings.preferredRegions));
  const preferredLanguages = new Set(normalizeTokens(settings.preferredLanguages));

  const scored = REPUTABLE_SOURCES.map((source) => {
    const interestTopicOverlap = source.topics.filter((topic) =>
      profile.interestTopics.includes(topic)
    ).length;
    const keywordTopicOverlap = source.topics.filter((topic) =>
      profile.anchorKeywordTopics.includes(topic)
    ).length;
    const contextualKeywordOverlap = source.topics.filter((topic) =>
      profile.contextualKeywordTopics.includes(topic)
    ).length;
    const termOverlap = source.topics.filter((topic) =>
      profile.coreTerms.some((term) => term.includes(topic) || topic.includes(term))
    ).length;
    const regionBoost = preferredRegions.has(source.region.toLowerCase()) ? 0.5 : 0;
    const languageBoost = preferredLanguages.has(source.language.toLowerCase()) ? 0.3 : 0;
    const feedbackBoost = clamp(profile.sourceScores[source.name] ?? 0, -2, 2) * 0.25;
    const contextualSourcePenalty =
      source.topics.some((topic) => isContextualTopic(topic)) &&
      interestTopicOverlap === 0 &&
      keywordTopicOverlap === 0
        ? 1.8 + contextualKeywordOverlap * 0.7
        : 0;

    return {
      source,
      score:
        interestTopicOverlap * 2.9 +
        keywordTopicOverlap * 1.3 +
        contextualKeywordOverlap * 0.15 +
        termOverlap * 1.2 +
        regionBoost +
        languageBoost +
        feedbackBoost -
        contextualSourcePenalty -
        source.priority * 0.1
    };
  })
    .filter(({ score, source }) => score > 0.75 || source.priority === 1)
    .sort((left, right) => right.score - left.score)
    .map(({ source }) => source);

  const fallback = REPUTABLE_SOURCES.filter(
    (source) => source.priority === 1 && !source.topics.every((topic) => isContextualTopic(topic))
  );
  return uniqueBy([...scored, ...fallback], (source) => source.id).slice(0, 10);
}

export function summarizeFeedbackMemory(feedbackMemory: FeedbackMemory) {
  return {
    likedSources: topScoredEntries(feedbackMemory.sourceScores, "positive", 4),
    dislikedSources: topScoredEntries(feedbackMemory.sourceScores, "negative", 4),
    likedTerms: topScoredEntries(feedbackMemory.termScores, "positive", 8),
    dislikedTerms: topScoredEntries(feedbackMemory.termScores, "negative", 8),
    likedTopics: topScoredEntries(feedbackMemory.topicScores, "positive", 6),
    dislikedTopics: topScoredEntries(feedbackMemory.topicScores, "negative", 6)
  };
}

export function inferTopicsFromTerms(terms: string[]): string[] {
  return inferDesiredTopics(terms);
}
