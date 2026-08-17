/**
 * Date-only helpers.
 *
 * Every date in this system is a `YYYY-MM-DD` string, never a JS `Date` — see
 * the DATE type parser in database/connection.ts for why. All arithmetic goes
 * through UTC so a local timezone or a DST transition can never shift a day.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Rejects impossible calendar dates such as 2025-02-30, which the regex allows.
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function toUtcMillis(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

/**
 * Number of days a rental occupies, counting both endpoints.
 * Spec §4: "same start/end date counts as 1 day".
 */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  return Math.round((toUtcMillis(endDate) - toUtcMillis(startDate)) / MS_PER_DAY) + 1;
}

/** Rounds money to 2 decimal places without binary-float drift. */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
