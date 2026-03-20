/**
 * Common utility helpers shared across backend modules.
 * 
 * @module Utils/Common
 */

/**
 * Generates a RFC 4122 v4 UUID using the Workers-native crypto API.
 * Identical to `crypto.randomUUID()` but explicitly named for clarity.
 */
export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Returns the current ISO timestamp string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Truncates a string to `maxLen` characters, appending "…" when truncated.
 */
export function truncate(str: string, maxLen = 200): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
