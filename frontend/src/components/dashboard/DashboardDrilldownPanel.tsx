import { useCallback, useRef, useState, type RefObject } from 'react'
import { X } from 'lucide-react'
import { DataTable } from '@/components/organisms/DataTable'
import { useAdminPageSize } from '@/hooks/useAdminPageSize'
import { Button } from '@material-tailwind/react'
import type { DashboardDrilldown } from '@/utils/dashboardDrilldown'
import { mt } from '@/utils/mt'

export function useDashboardDrilldown(defaultId: string | null = null) {
  const [activeId, setActiveId] = useState<string | null>(defaultId)
  const panelRef = useRef<HTMLDivElement>(null)

  const openDrilldown = useCallback((id: string) => {
    setActiveId(id)
    window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  const closeDrilldown = useCallback(() => setActiveId(defaultId), [defaultId])

  return { activeId, openDrilldown, closeDrilldown, panelRef: panelRef as RefObject<HTMLDivElement>, setActiveId }
}

type DashboardDrilldownPanelProps = {
  drilldowns: Record<string, DashboardDrilldown>
  activeId: string | null
  onClose: () => void
  panelRef: React.RefObject<HTMLDivElement>
}

export function DashboardDrilldownPanel({
  drilldowns,
  activeId,
  onClose,
  panelRef,
}: DashboardDrilldownPanelProps) {
  const pageSize = useAdminPageSize()
  if (!activeId) return null
  const drilldown = drilldowns[activeId]
  if (!drilldown) return null

  return (
    <div ref={panelRef} className="scroll-mt-24">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-moh-green">
          Drilldown · click a card above to change view
        </p>
        <Button
          {...mt}
          size="sm"
          variant="text"
          className="flex items-center gap-1 normal-case text-gray-600"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
      <DataTable
        title={drilldown.title}
        description={drilldown.description}
        columns={drilldown.columns}
        rows={drilldown.rows}
        perPage={pageSize}
        showRowNumbers
        emptyMessage="No records match this drilldown."
        highlighted
      />
    </div>
  )
}
