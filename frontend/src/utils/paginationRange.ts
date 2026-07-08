export type PageToken = number | 'ellipsis'

/** Build page number list with ellipsis, e.g. 1 … 4 5 6 … 15 */
export function buildPageList(current: number, total: number): PageToken[] {
  if (total <= 0) return []
  if (total === 1) return [1]
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: PageToken[] = [1]
  const windowStart = Math.max(2, current - 1)
  const windowEnd = Math.min(total - 1, current + 1)

  if (windowStart > 2) {
    pages.push('ellipsis')
  }

  for (let p = windowStart; p <= windowEnd; p++) {
    pages.push(p)
  }

  if (windowEnd < total - 1) {
    pages.push('ellipsis')
  }

  pages.push(total)
  return pages
}
