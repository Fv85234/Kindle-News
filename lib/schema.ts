import { z } from "zod";

import { DEFAULT_FEEDBACK_MEMORY } from "@/lib/defaults";

export const settingsSchema = z.object({
  interests: z.array(z.string().min(1)).min(1),
  keywords: z.array(z.string().min(1)),
  exclusions: z.array(z.string().min(1)),
  preferredRegions: z.array(z.string().min(1)).min(1),
  preferredLanguages: z.array(z.string().min(1)).min(1),
  kindleEmail: z.string().email().or(z.literal("")),
  senderEmail: z.string().email().or(z.literal("")),
  storyTarget: z.number().int().min(8).max(12),
  timezone: z.string().min(1),
  deliveryHour: z.number().int().min(0).max(23)
});

export const editionRecordSchema = z.object({
  id: z.string(),
  editionDate: z.string(),
  createdAt: z.string(),
  status: z.enum(["idle", "running", "sent", "failed"]),
  mode: z.enum(["manual", "scheduled"]).optional(),
  reason: z.string().optional(),
  candidateCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
  deliveredTo: z.string().optional(),
  epubPath: z.string().optional(),
  stories: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      sourceName: z.string(),
      categories: z.array(z.string()).default([]),
      matchedTerms: z.array(z.string()).default([]),
      feedback: z.enum(["up", "down"]).optional()
    })
  )
});

export const feedbackMemorySchema = z.object({
  sourceScores: z.record(z.string(), z.number()).default({}),
  termScores: z.record(z.string(), z.number()).default({}),
  topicScores: z.record(z.string(), z.number()).default({}),
  recentFeedback: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        sourceName: z.string(),
        categories: z.array(z.string()).default([]),
        matchedTerms: z.array(z.string()).default([]),
        reaction: z.enum(["up", "down"]),
        createdAt: z.string()
      })
    )
    .default([])
});

export const appDataSchema = z.object({
  settings: settingsSchema,
  deliveryHistory: z.array(editionRecordSchema),
  feedbackMemory: feedbackMemorySchema.default(DEFAULT_FEEDBACK_MEMORY)
});
