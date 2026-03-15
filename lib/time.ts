import { DateTime } from "luxon";

export type EditionWindow = {
  editionDate: string;
  windowStartIso: string;
  windowEndIso: string;
};

export type RecencyMode = "previous-only" | "previous-or-current";

export function getEditionWindow(
  timezone: string,
  now: DateTime<true> | DateTime<false> = DateTime.now()
): EditionWindow {
  const localNow = now.setZone(timezone);
  const previousDay = localNow.minus({ days: 1 }).startOf("day");
  const end = previousDay.endOf("day");

  return {
    editionDate: previousDay.toISODate() ?? localNow.toISODate() ?? "unknown",
    windowStartIso: previousDay.toUTC().toISO() ?? previousDay.toISO() ?? "",
    windowEndIso: end.toUTC().toISO() ?? end.toISO() ?? ""
  };
}

export function isWithinWindow(iso: string, window: EditionWindow): boolean {
  const timestamp = DateTime.fromISO(iso);
  return (
    timestamp.toMillis() >= DateTime.fromISO(window.windowStartIso).toMillis() &&
    timestamp.toMillis() <= DateTime.fromISO(window.windowEndIso).toMillis()
  );
}

export function getAllowedDigestDates(
  timezone: string,
  recencyMode: RecencyMode,
  now: DateTime<true> | DateTime<false> = DateTime.now()
): string[] {
  const localNow = now.setZone(timezone);
  const currentDate = localNow.startOf("day").toISODate();
  const previousDate = localNow.minus({ days: 1 }).startOf("day").toISODate();

  if (recencyMode === "previous-or-current") {
    return [previousDate, currentDate].filter(Boolean) as string[];
  }

  return [previousDate].filter(Boolean) as string[];
}

export function isWithinAllowedDigestDates(
  iso: string,
  timezone: string,
  recencyMode: RecencyMode,
  now: DateTime<true> | DateTime<false> = DateTime.now()
): boolean {
  const allowedDates = new Set(getAllowedDigestDates(timezone, recencyMode, now));
  const localDate = DateTime.fromISO(iso).setZone(timezone).toISODate();
  return localDate ? allowedDates.has(localDate) : false;
}
