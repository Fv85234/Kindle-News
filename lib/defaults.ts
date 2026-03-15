import { AppData, DigestSettings, FeedbackMemory, NewsSource } from "@/lib/types";

export const DEFAULT_SETTINGS: DigestSettings = {
  interests: ["technology", "economics", "europe", "artificial intelligence"],
  keywords: ["earnings", "policy", "innovation", "markets"],
  exclusions: ["sports", "celebrity gossip", "tabloids"],
  preferredRegions: ["global", "europe", "united states"],
  preferredLanguages: ["en"],
  kindleEmail: "",
  senderEmail: "",
  storyTarget: 10,
  timezone: "Europe/Madrid",
  deliveryHour: 11
};

export const DEFAULT_FEEDBACK_MEMORY: FeedbackMemory = {
  sourceScores: {},
  termScores: {},
  topicScores: {},
  recentFeedback: []
};

export const DEFAULT_APP_DATA: AppData = {
  settings: DEFAULT_SETTINGS,
  deliveryHistory: [],
  feedbackMemory: DEFAULT_FEEDBACK_MEMORY
};

export const REPUTABLE_SOURCES: NewsSource[] = [
  {
    id: "reuters-tech",
    name: "Reuters Technology",
    homepage: "https://www.reuters.com/technology/",
    rssUrl: "https://feeds.reuters.com/reuters/technologyNews",
    reputation: 0.98,
    region: "global",
    language: "en",
    topics: ["technology", "artificial intelligence", "innovation", "companies", "openai", "claude"],
    priority: 1
  },
  {
    id: "reuters-business",
    name: "Reuters Business",
    homepage: "https://www.reuters.com/business/",
    rssUrl: "https://feeds.reuters.com/reuters/businessNews",
    reputation: 0.98,
    region: "global",
    language: "en",
    topics: ["economics", "markets", "earnings", "companies", "policy", "trade"],
    priority: 1
  },
  {
    id: "reuters-world",
    name: "Reuters World",
    homepage: "https://www.reuters.com/world/",
    rssUrl: "https://feeds.reuters.com/Reuters/worldNews",
    reputation: 0.98,
    region: "global",
    language: "en",
    topics: ["world", "politics", "war", "geopolitics", "europe", "policy"],
    priority: 2
  },
  {
    id: "bbc-tech",
    name: "BBC Technology",
    homepage: "https://www.bbc.com/news/technology",
    rssUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    reputation: 0.95,
    region: "europe",
    language: "en",
    topics: ["technology", "artificial intelligence", "innovation", "science", "openai", "claude"],
    priority: 1
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    homepage: "https://www.bbc.com/news/business",
    rssUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
    reputation: 0.95,
    region: "europe",
    language: "en",
    topics: ["economics", "markets", "business", "earnings", "trade", "policy"],
    priority: 1
  },
  {
    id: "bbc-world",
    name: "BBC World",
    homepage: "https://www.bbc.com/news",
    rssUrl: "http://feeds.bbci.co.uk/news/world/rss.xml",
    reputation: 0.95,
    region: "europe",
    language: "en",
    topics: ["world", "politics", "war", "geopolitics", "europe"],
    priority: 2
  },
  {
    id: "nytimes-tech",
    name: "New York Times Technology",
    homepage: "https://www.nytimes.com/section/technology",
    rssUrl: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    reputation: 0.94,
    region: "united states",
    language: "en",
    topics: ["technology", "artificial intelligence", "innovation", "companies", "openai", "claude"],
    priority: 1
  },
  {
    id: "nytimes-business",
    name: "New York Times Business",
    homepage: "https://www.nytimes.com/section/business",
    rssUrl: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    reputation: 0.94,
    region: "united states",
    language: "en",
    topics: ["economics", "markets", "business", "earnings", "companies", "policy"],
    priority: 1
  },
  {
    id: "nytimes-world",
    name: "New York Times World",
    homepage: "https://www.nytimes.com/section/world",
    rssUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    reputation: 0.94,
    region: "united states",
    language: "en",
    topics: ["world", "politics", "war", "geopolitics", "europe"],
    priority: 2
  },
  {
    id: "guardian-tech",
    name: "The Guardian Technology",
    homepage: "https://www.theguardian.com/uk/technology",
    rssUrl: "https://www.theguardian.com/uk/technology/rss",
    reputation: 0.92,
    region: "europe",
    language: "en",
    topics: ["technology", "artificial intelligence", "innovation", "companies", "openai", "claude"],
    priority: 1
  },
  {
    id: "guardian-business",
    name: "The Guardian Business",
    homepage: "https://www.theguardian.com/uk/business",
    rssUrl: "https://www.theguardian.com/uk/business/rss",
    reputation: 0.92,
    region: "europe",
    language: "en",
    topics: ["economics", "markets", "business", "earnings", "policy", "trade"],
    priority: 1
  },
  {
    id: "guardian-world",
    name: "The Guardian World",
    homepage: "https://www.theguardian.com/world",
    rssUrl: "https://www.theguardian.com/world/rss",
    reputation: 0.92,
    region: "europe",
    language: "en",
    topics: ["world", "politics", "war", "geopolitics", "europe"],
    priority: 2
  },
  {
    id: "ft-home",
    name: "Financial Times",
    homepage: "https://www.ft.com/",
    rssUrl: "https://www.ft.com/rss/home",
    reputation: 0.93,
    region: "global",
    language: "en",
    topics: ["economics", "markets", "business", "technology", "policy", "world"],
    priority: 2
  }
];
