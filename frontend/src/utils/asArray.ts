/** Coerce unknown API payloads to arrays — avoids crashes when the API returns "" or null. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}
