import OpenAI from "openai";

import { summarizeFeedbackMemory } from "@/lib/preferences";
import { CandidateArticle, DigestSettings, FeedbackMemory } from "@/lib/types";

export async function rerankWithOpenAI(
  candidates: CandidateArticle[],
  settings: DigestSettings,
  feedbackMemory: FeedbackMemory
): Promise<CandidateArticle[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) {
    return candidates;
  }

  const client = new OpenAI({ apiKey });
  const candidateWindow = candidates.slice(0, 40);
  const remainder = candidates.slice(40);
  const feedbackSummary = summarizeFeedbackMemory(feedbackMemory);
  const prompt = [
    "Rank these news stories for a personal Kindle digest.",
    "Favor stories that directly match the user's explicit interests, keywords, and demonstrated feedback.",
    "A story should be ranked low if it only loosely matches a feed theme but does not clearly match the actual interests in the article title or summary.",
    "Prefer important business, technology, AI, policy, markets, and geopolitics coverage when relevant.",
    "Strongly demote generic crime, local incidents, celebrity, lifestyle, and off-topic human-interest coverage.",
    "Prefer representative stories with broad impact over marginally related but sensational items.",
    "Prefer a balanced digest across the user's different interests when enough relevant stories exist.",
    "Avoid overloading the ranking with one source or one single topic unless the user is narrowly focused on that topic.",
    "Demote stories that only match one broad keyword such as war or politics without also matching the user's stronger technology, AI, markets, or company interests.",
    "Treat broad political or war keywords as context, not as primary interest signals, unless the user explicitly centers their interests on them.",
    `Audience interests: ${settings.interests.join(", ")}.`,
    `Keywords: ${settings.keywords.join(", ")}.`,
    `Exclusions: ${settings.exclusions.join(", ")}.`,
    `Liked topics: ${feedbackSummary.likedTopics.join(", ") || "none yet"}.`,
    `Disliked topics: ${feedbackSummary.dislikedTopics.join(", ") || "none yet"}.`,
    `Liked terms: ${feedbackSummary.likedTerms.join(", ") || "none yet"}.`,
    `Disliked terms: ${feedbackSummary.dislikedTerms.join(", ") || "none yet"}.`,
    `Liked sources: ${feedbackSummary.likedSources.join(", ") || "none yet"}.`,
    `Disliked sources: ${feedbackSummary.dislikedSources.join(", ") || "none yet"}.`,
    "Return JSON only with an ordered array named ids."
  ].join(" ");

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_RANKING_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt }]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                candidateWindow.map((candidate) => ({
                  id: candidate.id,
                  title: candidate.title,
                  source: candidate.sourceName,
                  summary: candidate.summary,
                  categories: candidate.categories,
                  matchedTerms: candidate.matchedTerms,
                  matchedTopics: candidate.matchedTopics,
                  publishedAt: candidate.publishedAt,
                  heuristicScore: candidate.ranking.total,
                  clusterStrength: candidate.ranking.clusterStrength
                }))
              )
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ranked_story_ids",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ids: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["ids"]
          }
        }
      }
    });

    const output = response.output_text;
    const parsed = JSON.parse(output) as { ids?: string[] };
    if (!parsed.ids?.length) {
      return candidates;
    }

    const order = new Map(parsed.ids.map((id, index) => [id, index]));
    const reranked = [...candidateWindow].sort((left, right) => {
      const leftIndex = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
    return [...reranked, ...remainder];
  } catch {
    return candidates;
  }
}
