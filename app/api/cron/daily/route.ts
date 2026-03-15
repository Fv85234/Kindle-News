import { NextResponse } from "next/server";

import { runDailyDigest, shouldRunDigestNow } from "@/lib/digest";
import { toErrorMessage } from "@/lib/errors";
import { readAppData } from "@/lib/storage";

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await readAppData();
    if (!shouldRunDigestNow(data.settings.timezone, data.settings.deliveryHour)) {
      return NextResponse.json({
        skipped: true,
        message: "Not the configured delivery hour yet."
      });
    }

    const record = await runDailyDigest();
    return NextResponse.json(record, {
      status: record.status === "sent" ? 200 : 500
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
