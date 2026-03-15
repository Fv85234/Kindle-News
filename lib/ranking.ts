import { DateTime } from "luxon";

import { DEFAULT_FEEDBACK_MEMORY } from "@/lib/defaults";
import {
  buildPreferenceProfile,
  clamp,
  detectTopicsInText,
  extractImportantTokens,
  isContextualTopic
} from "@/lib/preferences";
import {
  CandidateArticle,
  DigestSettings,
  FeedbackMemory,
  NewsSource
} from "@/lib/types";
import { normalizeTokens, slugify, uniqueBy } from "@/lib/utils";

const BROAD_CONTEXT_TOPICS = new Set(["europe", "world", "politics"]);

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
      const anchorKeywordTitleMatches = profile.anchorKeywordTerms.filter((term) =>
        containsTerm(titleText, term)
      );
      const anchorKeywordSummaryMatches = profile.anchorKeywordTerms.filter((term) =>
        containsTerm(summaryText, term)
      );
      const anchorKeywordCategoryMatches = profile.anchorKeywordTerms.filter((term) =>
        containsTerm(categoryText, term)
      );
      const contextualKeywordTitleMatches = profile.contextualKeywordTerms.filter((term) =>
        containsTerm(titleText, term)
      );
      const contextualKeywordSummaryMatches = profile.contextualKeywordTerms.filter((term) =>
        containsTerm(summaryText, term)
      );
      const contextualKeywordCategoryMatches = profile.contextualKeywordTerms.filter((term) =>
        containsTerm(categoryText, term)
      );
      const coreSummaryMatches = profile.coreTerms.filter((term) =>
        containsTerm(summaryText, term)
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
      const anchorKeywordTopicHits = articleTopics.filter((topic) =>
        profile.anchorKeywordTopics.includes(topic)
      );
      const contextualKeywordTopicHits = articleTopics.filter((topic) =>
        profile.contextualKeywordTopics.includes(topic)
      );
      const topicHits = uniqueBy(
        [...interestTopicHits, ...keywordTopicHits].filter((topic) =>
          profile.desiredTopics.includes(topic)
        ),
        (topic) => topic
      );
      const strongTopicHits = topicHits.filter(
        (topic) => !BROAD_CONTEXT_TOPICS.has(topic) && !isContextualTopic(topic)
      );
      const sourceAffinity = article.source.topics.some((topic) =>
        profile.interestTopics.includes(topic)
      )
        ? 0.12
        : article.source.topics.some((topic) => profile.anchorKeywordTopics.includes(topic))
          ? 0.04
          : 0;
      const matchedTopics = uniqueBy(
        [...strongTopicHits, ...interestTopicHits, ...anchorKeywordTopicHits, ...contextualKeywordTopicHits],
        (topic) => topic
      ).slice(0, 4);
      const matchedTerms = uniqueBy(
        [
          ...interestTitleMatches,
          ...interestCategoryMatches,
          ...anchorKeywordTitleMatches,
          ...anchorKeywordCategoryMatches,
          ...anchorKeywordSummaryMatches,
          ...(interestTitleMatches.length > 0 ||
          interestCategoryMatches.length > 0 ||
          anchorKeywordTitleMatches.length > 0 ||
          anchorKeywordCategoryMatches.length > 0 ||
          strongTopicHits.length > 0
            ? [
                ...coreSummaryMatches,
                ...expansionTitleMatches,
                ...expansionCategoryMatches,
                ...expansionSummaryMatches,
                ...contextualKeywordTitleMatches,
                ...contextualKeywordCategoryMatches
              ]
            : []),
          ...topicHits
        ],
        (term) => term
      ).slice(0, 12);

      const titleWeight =
        interestTitleMatches.length * 3.2 +
        anchorKeywordTitleMatches.length * 3.8 +
        contextualKeywordTitleMatches.length * 0.55 +
        expansionTitleMatches.length * 0.9 +
        interestTopicHits.length * 0.8 +
        anchorKeywordTopicHits.length * 0.28 +
        contextualKeywordTopicHits.length * 0.08;
      const categoryWeight =
        interestCategoryMatches.length * 2.4 +
        anchorKeywordCategoryMatches.length * 2.8 +
        contextualKeywordCategoryMatches.length * 0.4 +
        expansionCategoryMatches.length * 0.65 +
        interestTopicHits.length * 0.55 +
        anchorKeywordTopicHits.length * 0.2 +
        contextualKeywordTopicHits.length * 0.05;
      const summaryWeight =
        interestSummaryMatches.length * 0.55 +
        anchorKeywordSummaryMatches.length * 0.75 +
        contextualKeywordSummaryMatches.length * 0.12 +
        expansionSummaryMatches.length * 0.18;
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
      const directAnchorKeywordHits =
        anchorKeywordTitleMatches.length +
        anchorKeywordCategoryMatches.length +
        anchorKeywordSummaryMatches.length;
      const directContextKeywordHits =
        contextualKeywordTitleMatches.length +
        contextualKeywordCategoryMatches.length +
        contextualKeywordSummaryMatches.length;
      const directKeywordHits = directAnchorKeywordHits + directContextKeywordHits;
      const directTitleHits = interestTitleMatches.length + anchorKeywordTitleMatches.length;
      const highSignalHits = directInterestHits + directAnchorKeywordHits;
      const contextOnlyMatch =
        highSignalHits === 0 &&
        strongTopicHits.length === 0 &&
        (directContextKeywordHits > 0 || contextualKeywordTopicHits.length > 0);
      const passesGate =
        avoidMatches.length === 0 &&
        (
          directTitleHits > 0 ||
          interestCategoryMatches.length > 0 ||
          anchorKeywordCategoryMatches.length > 0 ||
          (highSignalHits >= 2 && rawRelevance >= 2.2) ||
          (directInterestHits >= 1 && rawRelevance >= 2.1) ||
          (strongTopicHits.length > 0 && highSignalHits >= 1 && rawRelevance >= 2.1) ||
          (strongTopicHits.length > 0 && sourceAffinity > 0 && rawRelevance >= 2.9) ||
          (rawRelevance >= 5.4 && highSignalHits >= 2)
        ) &&
        !contextOnlyMatch;
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
        directInterestHits === 0 && directAnchorKeywordHits <= 1 && matchedTerms.length <= 2 ? 0.24 : 0;
      const keywordOnlyTopicPenalty = contextOnlyMatch ? 0.44 : directContextKeywordHits > 0 ? 0.12 : 0;
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
    return candidate.matchedTopics.find((topic) => !isContextualTopic(topic)) ??
      candidate.matchedTopics[0] ??
      "__general__";
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

  const strongTopicSeedCandidates = uniqueBy(
    candidates.filter((candidate) =>
      candidate.matchedTopics.some((topic) => !isContextualTopic(topic))
    ),
    (candidate) => getPrimaryTopic(candidate)
  );
  const fallbackTopicSeedCandidates = uniqueBy(
    candidates.filter((candidate) => candidate.matchedTopics.length > 0),
    (candidate) => getPrimaryTopic(candidate)
  );

  for (const candidate of [...strongTopicSeedCandidates, ...fallbackTopicSeedCandidates]) {
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
