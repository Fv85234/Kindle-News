import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";

import {
  getAllowedDigestDates,
  getEditionWindow,
  isWithinAllowedDigestDates,
  isWithinWindow
} from "@/lib/time";

describe("edition window", () => {
  test("uses the previous local day in Europe/Madrid", () => {
    const window = getEditionWindow(
      "Europe/Madrid",
      DateTime.fromISO("2026-03-14T11:00:00", { zone: "Europe/Madrid" })
    );

    expect(window.editionDate).toBe("2026-03-13");
    expect(isWithinWindow("2026-03-13T20:00:00.000Z", window)).toBe(true);
    expect(isWithinWindow("2026-03-14T02:00:00.000Z", window)).toBe(false);
  });

  test("manual runs can use current or previous local day only", () => {
    const now = DateTime.fromISO("2026-03-14T11:00:00", { zone: "Europe/Madrid" });

    expect(getAllowedDigestDates("Europe/Madrid", "previous-or-current", now)).toEqual([
      "2026-03-13",
      "2026-03-14"
    ]);
    expect(
      isWithinAllowedDigestDates(
        "2026-03-14T08:00:00.000+01:00",
        "Europe/Madrid",
        "previous-or-current",
        now
      )
    ).toBe(true);
    expect(
      isWithinAllowedDigestDates(
        "2026-03-12T23:00:00.000+01:00",
        "Europe/Madrid",
        "previous-or-current",
        now
      )
    ).toBe(false);
  });
});
