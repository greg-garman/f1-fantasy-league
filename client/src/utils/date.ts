/**
 * Safari-safe date parsing utilities.
 *
 * Safari parses date-only strings ("2026-03-15") as UTC midnight,
 * while Chrome parses them as local midnight. This causes off-by-one
 * day errors and incorrect countdown calculations.
 *
 * These helpers ensure consistent behavior across all browsers.
 */

/**
 * Parse a date string (with or without time) into a Date object.
 * Always treats date-only strings as UTC to avoid Safari issues.
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);

  // If the string already has a 'T' (ISO datetime), parse as-is
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }

  // Date-only string: "2026-03-15" → treat as UTC midnight
  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Build a race datetime from separate date and time fields.
 * Handles cases where time may or may not include a 'Z' suffix.
 */
export function parseRaceDateTime(dateStr: string, timeStr?: string | null): Date {
  if (!dateStr) return new Date(NaN);

  if (timeStr) {
    const utcTime = timeStr.endsWith('Z') ? timeStr : timeStr + 'Z';
    return new Date(`${dateStr}T${utcTime}`);
  }

  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Format a date-only string (e.g. "2026-03-15") for display.
 * Uses UTC interpretation to avoid Safari off-by-one errors.
 */
export function formatRaceDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseDate(dateStr);
  const defaultOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...options,
  };
  return date.toLocaleDateString('en-US', defaultOpts);
}
