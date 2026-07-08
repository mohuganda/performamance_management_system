import { useEffect, useMemo, useState } from 'react'

export function useClientPagination<T>(
  items: T[],
  perPage: number,
  resetDeps: unknown[] = [],
) {
  const [page, setPage] = useState(1)

  const total = items.length
  const total_pages = Math.max(1, Math.ceil(total / perPage) || 1)
  const safePage = Math.min(Math.max(1, page), total_pages)

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when filter deps change
  }, resetDeps)

  useEffect(() => {
    if (page > total_pages) {
      setPage(total_pages)
    }
  }, [page, total_pages])

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * perPage
    return items.slice(start, start + perPage)
  }, [items, safePage, perPage])

  const start = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const end = Math.min(safePage * perPage, total)
  const rangeLabel =
    total === 0
      ? 'No records'
      : `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} record${total === 1 ? '' : 's'}`

  return {
    page: safePage,
    setPage,
    pageItems,
    pagination: {
      total,
      page: safePage,
      per_page: perPage,
      total_pages,
    },
    rangeLabel,
  }
}
