import { DateTime } from "luxon";

import { DEFAULT_FEEDBACK_MEMORY } from "@/lib/defaults";
import {
  buildPreferenceProfile,
  clamp,
  detectTopicsInText,
  extractImportantTokens
} from "@/lib/preferences";
import {
  CandidateArticle,
  DigestSettings,
  FeedbackMemory,
  NewsSource
} from "@/lib/types";
import { normalizeTokens, slugify, uniqueBy } from "@/lib/utils";

const BROAD_CONTEXT_TOPICS = new Set(["europe", "world", "politics"]);
const SATURATED_TOPICS = new Set(["war", "politics", "world", "europe"]);

function containsTerm(text: string, term: string): boolean {
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

function toClusterKey(title: string): string {
  const tokens = extractImportantTokens(title).slice(0, 6).sort();
  return slugify(tokens.join(" ")) || slugify(title);
}

export type RawIngestedArticle = {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  feedHtml?: string;
  categories: string[];
  source: NewsSource;
  imageUrl?: string;
};

export function scoreCandidates(
  articles: RawIngestedArticle[],
  settings: DigestSettings,
  feedbackMemory: FeedbackMemory = DEFAULT_FEEDBACK_MEMORY
): CandidateArticle[] {
  const profile = buildPreferenceProfile(settings, feedbackMemory);
  const exclusions = normalizeTokens(settings.exclusions);
  const preferredRegions = new Set(normalizeTokens(settings.preferredRegions));
  const preferredLanguages = new Set(normalizeTokens(settings.preferredLanguages));
  const now = DateTime.utc();
  const clusterStats = new Map<
    string,
    {
      count: number;
      sourceIds: Set<string>;
    }
  >();

  for (const article of articles) {
    const clusterKey = toClusterKey(article.title);
    const current = clusterStats.get(clusterKey) ?? {
      count: 0,
      sourceIds: new Set<string>()
    };
    current.count += 1;
    current.sourceIds.add(article.source.id);
    clusterStats.set(clusterKey, current);
  }

  const scored = articles
    .filter((article) => {
      const searchable = `${article.title} ${article.summary}`.toLowerCase();
      return !exclusions.some((term) => searchable.includes(term));
    })
    .map((article) => {
      const titleText = article.title.toLowerCase();
      const summaryText = article.summary.toLowerCase();
      const categoryText = article.categories.join(" ").toLowerCase();
      const interestTitleMatches = profile.interestTerms.filter((term) =>
        containsTerm(titleText, term)
      );
      const interestSummaryMatches = profile.interestTerms.filter((term) =>
        containsTerm(summaryText, term)
      );
      const interestCategoryMatches = profile.interestTerms.filter((term) =>
        containsTerm(categoryText, term)
      );
      const keywordTitleMatches = profile.keywordTerms.filter((term) =>
        containsTerm(titleText, term)
      );
      const keywordSummaryMatches = profile.keywordTerms.filter((term) =>
        containsTerm(summaryText, term)
      );
      const keywordCategoryMatches = profile.keywordTerms.filter((term) =>
        containsTerm(categoryText, term)
      );
      const coreTitleMatches = profile.coreTerms.filter((term) => containsTerm(titleText, term));
      const coreSummaryMatches = profile.coreTerms.filter((term) =>
        containsTerm(summaryText, term)
      );
      const coreCategoryMatches = profile.coreTerms.filter((term) =>
        containsTerm(categoryText, term)
      );
      const expansionTitleMatches = profile.expansionTerms.filter((term) =>
        containsTerm(titleText, term)
      );
      const expansionSummaryMatches = profile.expansionTerms.filter((term) =>
        containsTerm(summaryText, term)
      );
      const expansionCategoryMatches = profile.expansionTerms.filter((term) =>
        containsTerm(categoryText, term)
      );
      const avoidMatches = profile.avoidTerms.filter(
        (term) =>
          containsTerm(titleText, term) ||
          containsTerm(summaryText, term) ||
          containsTerm(categoryText, term)
      );
      const articleTopics = detectTopicsInText(
        `${titleText} ${summaryText} ${categoryText}`
      );
      const interestTopicHits = articleTopics.filter((topic) =>
        profile.interestTopics.includes(topic)
      );
      const keywordTopicHits = articleTopics.filter((topic) =>
        profile.keywordTopics.includes(topic)
      );
      const topicHits = uniqueBy(
        [...interestTopicHits, ...keywordTopicHits].filter((topic) =>
          profile.desiredTopics.includes(topic)
        ),
        (topic) => topic
      );
      const strongTopicHits = topicHits.filter((topic) => !BROAD_CONTEXT_TOPICS.has(topic));
      const sourceAffinity = article.source.topics.some((topic) =>
        profile.interestTopics.includes(topic)
      )
        ? 0.12
        : article.source.topics.some((topic) => profile.keywordTopics.includes(topic))
          ? 0.04
          : 0;
      const matchedTopics = uniqueBy(
        [...interestTopicHits, ...keywordTopicHits, ...strongTopicHits],
        (topic) => topic
      ).slice(0, 4);
      const matchedTerms = uniqueBy(
        [
          ...interestTitleMatches,
          ...interestCategoryMatches,
          ...keywordTitleMatches,
          ...keywordCategoryMatches,
          ...coreSummaryMatches,
          ...expansionTitleMatches,
          ...expansionCategoryMatches,
          ...expansionSummaryMatches,
          ...topicHits
        ],
        (term) => term
      ).slice(0, 12);

      const titleWeight =
        interestTitleMatches.length * 3.2 +
        keywordTitleMatches.length * 3.8 +
        expansionTitleMatches.length * 0.9 +
        interestTopicHits.length * 0.8 +
        keywordTopicHits.length * 0.28;
      const categoryWeight =
        interestCategoryMatches.length * 2.4 +
        keywordCategoryMatches.length * 2.8 +
        expansionCategoryMatches.length * 0.65 +
        interestTopicHits.length * 0.55 +
        keywordTopicHits.length * 0.2;
      const summaryWeight =
        interestSummaryMatches.length * 0.55 +
        keywordSummaryMatches.length * 0.75 +
        expansionSummaryMatches.length * 0.28;
      const sourceFeedback = clamp(profile.sourceScores[article.source.name] ?? 0, -3, 3) * 0.08;
      const termFeedback = matchedTerms.reduce(
        (score, term) => score + clamp(profile.termScores[term] ?? 0, -3, 3) * 0.05,
        0
      );
      const topicFeedback = topicHits.reduce(
        (score, topic) => score + clamp(profile.topicScores[topic] ?? 0, -3, 3) * 0.06,
        0
      );
      const rawRelevance =
        titleWeight +
        categoryWeight +
        summaryWeight +
        sourceFeedback +
        termFeedback +
        topicFeedback -
        avoidMatches.length * 2.4 +
        sourceAffinity;
      const directInterestHits =
        interestTitleMatches.length +
        interestCategoryMatches.length +
        interestSummaryMatches.length;
      const directKeywordHits =
        keywordTitleMatches.length +
        keywordCategoryMatches.length +
        keywordSummaryMatches.length;
      const directTitleHits = interestTitleMatches.length + keywordTitleMatches.length;
      const keywordOnlyBroadMatch =
        directInterestHits === 0 &&
        interestTopicHits.length === 0 &&
        directKeywordHits <= 2 &&
        keywordTopicHits.some((topic) => SATURATED_TOPICS.has(topic));
      const passesGate =
        avoidMatches.length === 0 &&
        (
          directTitleHits > 0 ||
          interestCategoryMatches.length > 0 ||
          keywordCategoryMatches.length > 0 ||
          (directKeywordHits >= 2 && rawRelevance >= 2.5) ||
          (directInterestHits >= 1 && rawRelevance >= 2.2) ||
          (interestTopicHits.length > 0 && rawRelevance >= 2.3) ||
          (strongTopicHits.length > 0 && (directInterestHits > 0 || directKeywordHits > 1) && rawRelevance >= 2.8) ||
          (rawRelevance >= 5.2 && directInterestHits + directKeywordHits >= 2)
        ) &&
        !(keywordOnlyBroadMatch && rawRelevance < 5.8);
      const topicMatch = clamp(rawRelevance / 6.2, 0, 1.35);
      const sourceReputation = article.source.reputation;
      const regionBoost = preferredRegions.has(article.source.region.toLowerCase()) ? 0.12 : 0;
      const languageBoost = preferredLanguages.has(article.source.language.toLowerCase()) ? 0.08 : 0;
      const ageHours = Math.max(now.diff(DateTime.fromISO(article.publishedAt), "hours").hours, 0);
      const freshness = Math.max(0, 1 - ageHours / 36);
      const cluster = clusterStats.get(toClusterKey(article.title)) ?? {
        count: 1,
        sourceIds: new Set<string>([article.source.id])
      };
      const clusterStrength = clamp(
        ((cluster.count - 1) * 0.45 + (cluster.sourceIds.size - 1) * 0.7) / 3,
        0,
        1
      );
      const titleRichness = clamp(extractImportantTokens(article.title).length / 8, 0, 1);
      const importance = clamp(
        sourceReputation * 0.3 +
          clusterStrength * 0.42 +
          titleRichness * 0.1 +
          regionBoost +
          languageBoost +
          (interestTopicHits.length > 0 ? 0.12 : strongTopicHits.length > 0 ? 0.04 : 0),
        0,
        1.25
      );
      const feedbackBoost = clamp(sourceFeedback + termFeedback + topicFeedback, -0.3, 0.35);
      const offTopicPenalty = passesGate ? 0 : 0.85;
      const narrowMatchPenalty =
        directInterestHits === 0 && directKeywordHits <= 1 && matchedTerms.length <= 2 ? 0.24 : 0;
      const keywordOnlyTopicPenalty = keywordOnlyBroadMatch ? 0.34 : 0;
      const total = Number(
        (
          topicMatch * 0.52 +
          importance * 0.22 +
          freshness * 0.08 +
          sourceReputation * 0.05 +
          clusterStrength * 0.08 +
          feedbackBoost -
          narrowMatchPenalty -
          keywordOnlyTopicPenalty -
          offTopicPenalty
        ).toFixed(4)
      );

      return {
        id: `${article.source.id}-${slugify(article.title)}`,
        sourceId: article.source.id,
        sourceName: article.source.name,
        title: article.title,
        url: article.url,
        publishedAt: article.publishedAt,
        summary: article.summary,
        feedHtml: article.feedHtml,
        categories: article.categories,
        matchedTerms,
        matchedTopics,
        imageUrl: article.imageUrl,
        clusterKey: toClusterKey(article.title),
        ranking: {
          topicMatch,
          importance,
          freshness,
          sourceReputation,
          clusterStrength,
          feedbackBoost,
          offTopicPenalty,
          diversityPenalty: 0,
          total
        }
      } satisfies CandidateArticle;
    })
    .filter((article) => article.ranking.offTopicPenalty === 0)
    .sort((left, right) => right.ranking.total - left.ranking.total);

  return uniqueBy(scored, (article) => article.url);
}

export function selectTopStories(
  candidates: CandidateArticle[],
  storyTarget: number
): CandidateArticle[] {
  const selected: CandidateArticle[] = [];
  const clusterCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const selectedIds = new Set<string>();
  const maxPerSource = storyTarget >= 8 ? 2 : 1;
  const maxPerTopic = storyTarget >= 10 ? 3 : 2;

  function getPrimaryTopic(candidate: CandidateArticle): string {
    return candidate.matchedTopics[0] ?? "__general__";
  }

  function trySelectCandidate(
    candidate: CandidateArticle,
    minimumScore: number,
    sourcePenaltyAfter: number
  ) {
    if (selectedIds.has(candidate.id)) {
      return;
    }

    const sameClusterCount = clusterCounts.get(candidate.clusterKey) ?? 0;
    const sameSourceCount = sourceCounts.get(candidate.sourceId) ?? 0;
    const primaryTopic = getPrimaryTopic(candidate);
    const sameTopicCount = topicCounts.get(primaryTopic) ?? 0;
    const diversityPenalty =
      sameClusterCount > 0 ? 0.34 : sameSourceCount >= sourcePenaltyAfter ? 0.12 : 0;
    const topicPenalty =
      primaryTopic !== "__general__" && sameTopicCount > 0
        ? Math.min(0.06 * sameTopicCount, 0.18)
        : 0;
    const adjustedTotal = candidate.ranking.total - diversityPenalty - topicPenalty;

    if (sameClusterCount > 0) {
      return;
    }

    if (sameSourceCount >= maxPerSource) {
      return;
    }

    if (primaryTopic !== "__general__" && sameTopicCount >= maxPerTopic) {
      return;
    }

    if (adjustedTotal < minimumScore) {
      return;
    }

    selected.push({
      ...candidate,
      ranking: {
        ...candidate.ranking,
        diversityPenalty,
        total: adjustedTotal
      }
    });
    selectedIds.add(candidate.id);

    clusterCounts.set(candidate.clusterKey, sameClusterCount + 1);
    sourceCounts.set(candidate.sourceId, sameSourceCount + 1);
    topicCounts.set(primaryTopic, sameTopicCount + 1);
  }

  const topicSeedCandidates = uniqueBy(
    candidates.filter((candidate) => candidate.matchedTopics.length > 0),
    (candidate) => getPrimaryTopic(candidate)
  );

  for (const candidate of topicSeedCandidates) {
    trySelectCandidate(candidate, 0.4, 1);

    if (selected.length >= storyTarget) {
      break;
    }
  }

  for (const candidate of candidates) {
    trySelectCandidate(candidate, 0.48, 1);

    if (selected.length >= storyTarget) {
      break;
    }
  }

  if (selected.length < storyTarget) {
    for (const candidate of candidates) {
      trySelectCandidate(candidate, 0.34, 2);

      if (selected.length >= storyTarget) {
        break;
      }
    }
  }

  return selected;
}
