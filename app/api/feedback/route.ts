import { NextResponse } from "next/server";

import { toErrorMessage } from "@/lib/errors";
import { recordStoryFeedback } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      editionId?: string;
      url?: string;
      reaction?: "up" | "down";
    };

    if (!payload.editionId || !payload.url || !payload.reaction) {
      return NextResponse.json(
        { error: "editionId, url, and reaction are required." },
        { status: 400 }
      );
    }

    const data = await recordStoryFeedback({
      editionId: payload.editionId,
      url: payload.url,
      reaction: payload.reaction
    });

    return NextResponse.json({
      ok: true,
      deliveryHistory: data.deliveryHistory
    });
  } catch (error) {
    return NextResponse.json(
      { error: toErrorMessage(error) },
      { status: 500 }
    );
  }
}
