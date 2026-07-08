/** Unwrap Goravel/axios payloads that may nest data under `data`. */
export function unwrapApiData<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) {
    const nested = (value as { data?: unknown }).data
    if (nested !== undefined && nested !== null && typeof nested === 'object') {
      return nested as T
    }
  }
  return value as T
}
