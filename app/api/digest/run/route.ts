import { NextResponse } from "next/server";

import { runDailyDigest } from "@/lib/digest";
import { toErrorMessage } from "@/lib/errors";

export async function POST() {
  try {
    const record = await runDailyDigest({
      force: true,
      recencyMode: "previous-or-current",
      mode: "manual"
    });
    const ok = record.status === "sent";

    return NextResponse.json(
      {
        message: ok
          ? `Digest sent with ${record.selectedCount} stories.`
          : `Digest run failed: ${record.reason}`,
        error: ok ? undefined : record.reason ?? "Digest run failed.",
        record
      },
      { status: ok ? 200 : 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: toErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
