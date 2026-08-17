/** Format minutes as h:mm — every duration in EM uses this ledger style. */
export function fmtMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Format minutes as decimal hours for summaries, e.g. 39.50 */
export function fmtHours(minutes: number, digits = 2): string {
  return (minutes / 60).toFixed(digits);
}

/**
 * Parse user input into minutes.
 * Accepts "8" (hours), "8.5", "8:30", "0:45". Empty string → 0.
 * Returns null for unparseable input.
 */
export function parseToMinutes(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return 0;
  if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    if (m >= 60) return null;
    return h * 60 + m;
  }
  if (/^\d{1,2}([.,]\d{1,4})?$/.test(s)) {
    return Math.round(parseFloat(s.replace(",", ".")) * 60);
  }
  return null;
}
