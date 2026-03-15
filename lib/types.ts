export type DigestSettings = {
  interests: string[];
  keywords: string[];
  exclusions: string[];
  preferredRegions: string[];
  preferredLanguages: string[];
  kindleEmail: string;
  senderEmail: string;
  storyTarget: number;
  timezone: string;
  deliveryHour: number;
};

export type NewsSource = {
  id: string;
  name: string;
  homepage: string;
  rssUrl: string;
  reputation: number;
  region: string;
  language: string;
  topics: string[];
  priority: number;
};

export type CandidateArticle = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  feedHtml?: string;
  categories: string[];
  matchedTerms: string[];
  matchedTopics: string[];
  imageUrl?: string;
  clusterKey: string;
  ranking: RankingBreakdown;
};

export type RankingBreakdown = {
  topicMatch: number;
  importance: number;
  freshness: number;
  sourceReputation: number;
  clusterStrength: number;
  feedbackBoost: number;
  offTopicPenalty: number;
  diversityPenalty: number;
  total: number;
};

export type ExtractedArticle = CandidateArticle & {
  author?: string;
  contentHtml: string;
  plainText: string;
  extractionKind: "article" | "feed" | "summary";
};

export type EditionRecord = {
  id: string;
  editionDate: string;
  createdAt: string;
  status: "idle" | "running" | "sent" | "failed";
  mode?: "manual" | "scheduled";
  reason?: string;
  candidateCount: number;
  selectedCount: number;
  deliveredTo?: string;
  epubPath?: string;
  stories: Array<{
    title: string;
    url: string;
    sourceName: string;
    categories: string[];
    matchedTerms: string[];
    feedback?: StoryReaction;
  }>;
};

export type StoryReaction = "up" | "down";

export type FeedbackEvent = {
  url: string;
  title: string;
  sourceName: string;
  categories: string[];
  matchedTerms: string[];
  reaction: StoryReaction;
  createdAt: string;
};

export type FeedbackMemory = {
  sourceScores: Record<string, number>;
  termScores: Record<string, number>;
  topicScores: Record<string, number>;
  recentFeedback: FeedbackEvent[];
};

export type AppData = {
  settings: DigestSettings;
  deliveryHistory: EditionRecord[];
  feedbackMemory: FeedbackMemory;
};
