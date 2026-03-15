import os from "node:os";
import { del as deleteBlob, get as getBlob, list as listBlobs, put as putBlob } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_APP_DATA } from "@/lib/defaults";
import { clamp, extractImportantTokens, inferTopicsFromTerms } from "@/lib/preferences";
import { appDataSchema } from "@/lib/schema";
import { AppData, EditionRecord, FeedbackMemory, StoryReaction } from "@/lib/types";
import { normalizeTokens } from "@/lib/utils";

const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "kindle-news-digest")
  : path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "app-data.json");
const editionsDir = path.join(dataDir, "editions");
const blobAppDataPrefix = "state/app-data";
const legacyBlobAppDataPath = "state/app-data.json";
const blobEditionsPrefix = "editions";
const MAX_STORED_STATE_VERSIONS = 5;

function usesBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobAccessMode(): "public" | "private" {
  return process.env.BLOB_STORE_ACCESS === "private" ? "private" : "public";
}

async function ensureLocalStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(editionsDir, { recursive: true });
}

async function readLocalAppDataIfPresent(): Promise<AppData | null> {
  await ensureLocalStorage();

  try {
    const raw = await fs.readFile(dataFile, "utf8");
    return appDataSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function readLocalAppData(): Promise<AppData> {
  const existing = await readLocalAppDataIfPresent();
  if (existing) {
    return existing;
  }

  await writeLocalAppData(DEFAULT_APP_DATA);
  return DEFAULT_APP_DATA;
}

async function writeLocalAppData(data: AppData): Promise<void> {
  await ensureLocalStorage();
  const tempFile = `${dataFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tempFile, dataFile);
}

async function readBlobText(pathname: string): Promise<string | null> {
  try {
    const result = await getBlob(pathname, { access: getBlobAccessMode() });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    return new Response(result.stream).text();
  } catch {
    return null;
  }
}

async function findLatestBlobPath(prefix: string): Promise<string | null> {
  try {
    const response = await listBlobs({ prefix, limit: 20 });
    if (!response.blobs.length) {
      return null;
    }

    const latest = [...response.blobs].sort(
      (left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime()
    )[0];

    return latest?.pathname ?? null;
  } catch {
    return null;
  }
}

async function writeBlobData(
  pathname: string,
  body: string | Buffer,
  contentType: string
): Promise<string> {
  const result = await putBlob(pathname, body, {
    access: getBlobAccessMode(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType
  });

  return result.pathname;
}

async function readBlobAppData(): Promise<AppData | null> {
  const latestPath =
    (await findLatestBlobPath(`${blobAppDataPrefix}-`)) ?? legacyBlobAppDataPath;
  const raw = await readBlobText(latestPath);
  if (!raw) {
    return null;
  }

  return appDataSchema.parse(JSON.parse(raw));
}

async function writeBlobAppData(data: AppData): Promise<void> {
  const pathname = `${blobAppDataPrefix}-${Date.now()}.json`;
  await writeBlobData(
    pathname,
    JSON.stringify(data, null, 2),
    "application/json; charset=utf-8"
  );

  void cleanupOldBlobStateFiles();
}

async function cleanupOldBlobStateFiles() {
  try {
    const response = await listBlobs({ prefix: `${blobAppDataPrefix}-`, limit: 20 });
    const stale = [...response.blobs]
      .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
      .slice(MAX_STORED_STATE_VERSIONS)
      .map((blob) => blob.pathname);

    if (stale.length > 0) {
      await deleteBlob(stale);
    }
  } catch {
    // Ignore cleanup failures; keeping extra state snapshots is harmless.
  }
}

async function seedBlobStorage(): Promise<AppData> {
  const local = await readLocalAppDataIfPresent();
  const next = local ?? DEFAULT_APP_DATA;
  await writeBlobAppData(next);
  return next;
}

export async function readAppData(): Promise<AppData> {
  try {
    if (!usesBlobStorage()) {
      return await readLocalAppData();
    }

    try {
      const remote = await readBlobAppData();
      if (remote) {
        return remote;
      }

      return await seedBlobStorage();
    } catch {
      return await readLocalAppData();
    }
  } catch {
    return DEFAULT_APP_DATA;
  }
}

export async function writeAppData(data: AppData): Promise<void> {
  if (!usesBlobStorage()) {
    await writeLocalAppData(data);
    return;
  }

  try {
    await writeBlobAppData(data);
  } catch {
    await writeLocalAppData(data);
  }
}

export async function updateSettings(nextSettings: AppData["settings"]): Promise<AppData> {
  const current = await readAppData();
  const updated = {
    ...current,
    settings: nextSettings
  };
  await writeAppData(updated);
  return updated;
}

export async function appendEdition(record: EditionRecord): Promise<void> {
  const current = await readAppData();
  current.deliveryHistory = [record, ...current.deliveryHistory].slice(0, 30);
  await writeAppData(current);
}

export async function persistEditionBinary(fileName: string, buffer: Buffer): Promise<string> {
  if (!usesBlobStorage()) {
    await ensureLocalStorage();
    const filePath = path.join(editionsDir, fileName);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  try {
    const pathname = `${blobEditionsPrefix}/${fileName}`;
    const storedPath = await writeBlobData(pathname, buffer, "application/epub+zip");
    return `blob:${storedPath}`;
  } catch {
    await ensureLocalStorage();
    const filePath = path.join(editionsDir, fileName);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }
}

function adjustScore(
  map: Record<string, number>,
  key: string,
  delta: number
) {
  if (!key) {
    return;
  }

  const next = Number(clamp((map[key] ?? 0) + delta, -6, 6).toFixed(2));
  if (next === 0) {
    delete map[key];
    return;
  }

  map[key] = next;
}

function applyFeedbackToMemory(
  feedbackMemory: FeedbackMemory,
  story: EditionRecord["stories"][number],
  reaction: StoryReaction,
  multiplier: 1 | -1
) {
  const direction = reaction === "up" ? 1 : -1;
  const delta = direction * multiplier;
  const terms = normalizeTokens(Array.from(
    new Set([
      ...story.categories,
      ...story.matchedTerms,
      ...extractImportantTokens(story.title).slice(0, 5)
    ])
  )).slice(0, 12);
  const topics = inferTopicsFromTerms([...story.categories, ...story.matchedTerms, ...terms]);

  adjustScore(feedbackMemory.sourceScores, story.sourceName, delta * 1.2);
  for (const term of terms) {
    adjustScore(feedbackMemory.termScores, term, delta * 0.65);
  }
  for (const topic of topics) {
    adjustScore(feedbackMemory.topicScores, topic, delta);
  }
}

export async function recordStoryFeedback(input: {
  editionId: string;
  url: string;
  reaction: StoryReaction;
}) {
  const data = await readAppData();
  const edition = data.deliveryHistory.find((record) => record.id === input.editionId);
  if (!edition) {
    throw new Error("Edition not found.");
  }

  const story = edition.stories.find((entry) => entry.url === input.url);
  if (!story) {
    throw new Error("Story not found.");
  }

  if (story.feedback && story.feedback === input.reaction) {
    return data;
  }

  if (story.feedback) {
    applyFeedbackToMemory(data.feedbackMemory, story, story.feedback, -1);
  }

  story.feedback = input.reaction;
  applyFeedbackToMemory(data.feedbackMemory, story, input.reaction, 1);
  data.feedbackMemory.recentFeedback = [
    {
      url: story.url,
      title: story.title,
      sourceName: story.sourceName,
      categories: story.categories,
      matchedTerms: story.matchedTerms,
      reaction: input.reaction,
      createdAt: new Date().toISOString()
    },
    ...data.feedbackMemory.recentFeedback.filter((event) => event.url !== story.url)
  ].slice(0, 60);

  await writeAppData(data);
  return data;
}
