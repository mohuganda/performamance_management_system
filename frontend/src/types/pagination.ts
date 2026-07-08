export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return Array.isArray(obj.data) && typeof obj.total === 'number'
}

export function unwrapPaginated<T>(value: unknown): PaginatedResponse<T> {
  if (isPaginatedResponse<T>(value)) {
    return value
  }
  const rows = Array.isArray(value) ? (value as T[]) : []
  return {
    data: rows,
    total: rows.length,
    page: 1,
    per_page: rows.length || 20,
    total_pages: 1,
  }
}
