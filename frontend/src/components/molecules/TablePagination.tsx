import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildPageList } from '@/utils/paginationRange'
import { cn } from '@/utils/cn'

type TablePaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  /** Optional summary, e.g. "1–20 of 240 records" */
  summary?: string
}

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  className,
  summary,
}: TablePaginationProps) {
  const tokens = buildPageList(page, totalPages)
  const canPrev = page > 1
  const canNext = page < totalPages

  if (totalPages <= 1 && !summary) {
    return null
  }

  if (totalPages <= 1 && summary) {
    return (
      <div className={cn('flex justify-end border-t border-gray-100 bg-white px-2 py-3', className)}>
        <p className="text-xs text-gray-500">{summary}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white px-2 py-3',
        className,
      )}
    >
      {summary ? <p className="text-xs text-gray-500">{summary}</p> : <span />}
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors',
            canPrev
              ? 'text-gray-900 hover:bg-gray-100'
              : 'cursor-not-allowed text-gray-300',
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {tokens.map((token, index) =>
          token === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-9 min-w-[2rem] items-center justify-center px-1 text-sm text-gray-400"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              aria-current={token === page ? 'page' : undefined}
              className={cn(
                'flex h-9 min-w-[2.25rem] items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors',
                token === page
                  ? 'bg-gray-100 text-gray-900 shadow-sm'
                  : 'text-gray-900 hover:bg-gray-50',
              )}
            >
              {token}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors',
            canNext
              ? 'text-gray-900 hover:bg-gray-100'
              : 'cursor-not-allowed text-gray-300',
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  )
}
