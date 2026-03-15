import { NextResponse } from "next/server";

import { settingsSchema } from "@/lib/schema";
import { readAppData, updateSettings } from "@/lib/storage";
import { splitList } from "@/lib/utils";

function normalizePayload(payload: Record<string, unknown>) {
  return {
    interests: splitList(String(payload.interests ?? "")),
    keywords: splitList(String(payload.keywords ?? "")),
    exclusions: splitList(String(payload.exclusions ?? "")),
    preferredRegions: splitList(String(payload.preferredRegions ?? "")),
    preferredLanguages: splitList(String(payload.preferredLanguages ?? "")),
    kindleEmail: String(payload.kindleEmail ?? "").trim(),
    senderEmail: String(payload.senderEmail ?? "").trim(),
    storyTarget: Number(payload.storyTarget ?? 10),
    timezone: String(payload.timezone ?? "Europe/Madrid").trim(),
    deliveryHour: Number(payload.deliveryHour ?? 11)
  };
}

export async function GET() {
  const data = await readAppData();
  return NextResponse.json(data.settings);
}

export async function PUT(request: Request) {
  try {
    const payload = normalizePayload((await request.json()) as Record<string, unknown>);
    const settings = settingsSchema.parse(payload);
    const updated = await updateSettings(settings);
    return NextResponse.json(updated.settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid settings payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
