import { useEffect, useMemo, useState } from 'react'
import { HighchartsReact } from 'highcharts-react-official'
import ugMap from '@highcharts/map-collection/countries/ug/ug-all.geo.json'
import Highcharts from '@/lib/highchartsMap'
import type { DistrictCoverage, UgandaMapMetric } from '@/types/dashboard'
import { Card } from '@/components/atoms/Card'

type GeoFeature = {
  properties: {
    name: string
    'hc-key': string
    hasc?: string
    region?: string
  }
}

const METRIC_OPTIONS: Array<{ value: UgandaMapMetric; label: string; isPercent: boolean }> = [
  { value: 'staff_count', label: 'Staff on PMS', isPercent: false },
  { value: 'combined_rate', label: 'Combined attendance', isPercent: true },
  { value: 'oos_attendance_rate', label: 'OOS GPS compliance', isPercent: true },
  { value: 'hrm_summary_rate', label: 'HRM duty summary', isPercent: true },
]

function metricValue(d: DistrictCoverage, metric: UgandaMapMetric): number {
  switch (metric) {
    case 'staff_count':
      return d.staff_count
    case 'combined_rate':
      return d.combined_rate
    case 'oos_attendance_rate':
      return d.oos_attendance_rate
    case 'hrm_summary_rate':
      return d.hrm_summary_rate
    default:
      return 0
  }
}

function buildNameToMapKey(): Map<string, string> {
  const lookup = new Map<string, string>()
  const features = (ugMap as { features?: GeoFeature[] }).features ?? []
  for (const feature of features) {
    const name = feature.properties.name
    const mapKey = feature.properties['hc-key']
    lookup.set(name.toLowerCase(), mapKey)
    lookup.set(name.toLowerCase().replace(/\s+/g, ''), mapKey)
  }
  return lookup
}

function resolveMapKey(district: DistrictCoverage, nameLookup: Map<string, string>): string | undefined {
  if (district.map_key) return district.map_key
  const key = district.district.toLowerCase()
  return nameLookup.get(key) ?? nameLookup.get(key.replace(/\s+/g, ''))
}

interface UgandaDistrictMapProps {
  districts: DistrictCoverage[]
  title?: string
  onDistrictClick?: (district: DistrictCoverage) => void
}

export function UgandaDistrictMap({
  districts,
  title = 'Uganda — district coverage map',
  onDistrictClick,
}: UgandaDistrictMapProps) {
  const [mapError, setMapError] = useState(false)
  const [metric, setMetric] = useState<UgandaMapMetric>('combined_rate')
  const [showLabels, setShowLabels] = useState(false)

  const nameToMapKey = useMemo(() => buildNameToMapKey(), [])

  const districtsByMapKey = useMemo(() => {
    const map = new Map<string, DistrictCoverage>()
    for (const d of districts) {
      const mapKey = resolveMapKey(d, nameToMapKey)
      if (mapKey) map.set(mapKey, d)
    }
    return map
  }, [districts, nameToMapKey])

  const matchedCount = districtsByMapKey.size

  useEffect(() => {
    setMapError(false)
  }, [districts, metric])

  const options = useMemo<Highcharts.Options>(() => {
    const metricMeta = METRIC_OPTIONS.find((m) => m.value === metric) ?? METRIC_OPTIONS[1]

    const mapData = districts
      .map((d) => {
        const mapKey = resolveMapKey(d, nameToMapKey)
        if (!mapKey) return null
        return {
          'hc-key': mapKey,
          value: metricValue(d, metric),
          name: d.district,
          iso_code: d.iso_code ?? '—',
          region: d.region ?? '—',
          staff_count: d.staff_count,
          combined_rate: d.combined_rate,
          oos_attendance_rate: d.oos_attendance_rate,
          hrm_summary_rate: d.hrm_summary_rate,
        }
      })
      .filter(Boolean)

    const maxStaff = Math.max(...districts.map((d) => d.staff_count), 1)

    const colorAxis: Highcharts.ColorAxisOptions = metricMeta.isPercent
      ? {
          min: 70,
          max: 100,
          stops: [
            [0, '#D32F2F'],
            [0.45, '#F9A825'],
            [0.75, '#66BB6A'],
            [1, '#2E7D32'],
          ],
        }
      : {
          min: 0,
          max: maxStaff,
          stops: [
            [0, '#E3F2FD'],
            [0.35, '#64B5F6'],
            [0.7, '#1565C0'],
            [1, '#0D47A1'],
          ],
        }

    return {
      chart: { map: ugMap as Highcharts.GeoJSON, backgroundColor: 'transparent', height: 480 },
      title: { text: undefined },
      credits: { enabled: false },
      mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
      colorAxis,
      legend: {
        enabled: true,
        layout: 'horizontal',
        align: 'center',
        verticalAlign: 'bottom',
        symbolWidth: 280,
      },
      tooltip: {
        useHTML: true,
        headerFormat: '',
        pointFormat:
          '<b>{point.name}</b> <span style="color:#666">({point.iso_code})</span><br/>' +
          'Region: {point.region}<br/>' +
          'Staff on PMS: <b>{point.staff_count}</b><br/>' +
          'Combined: <b>{point.combined_rate}%</b> · OOS: {point.oos_attendance_rate}% · HRM: {point.hrm_summary_rate}%',
      },
      series: [
        {
          type: 'map',
          name: metricMeta.label,
          mapData: ugMap as Highcharts.GeoJSON,
          joinBy: 'hc-key',
          data: mapData as Highcharts.PointOptionsObject[],
          nullColor: '#F1F8E9',
          borderColor: '#1B5E20',
          borderWidth: 0.5,
          states: {
            hover: { brightness: 0.08, borderColor: '#000' },
            select: { color: '#F9A825', borderColor: '#000', borderWidth: 1.2 },
          },
          allowPointSelect: true,
          dataLabels: {
            enabled: showLabels,
            format: '{point.name}',
            style: { fontSize: '7px', fontWeight: 'normal', textOutline: 'none', color: '#1B5E20' },
          },
          point: {
            events: {
              click: function (this: Highcharts.Point) {
                const opts = this.options as Highcharts.PointOptionsObject & { 'hc-key'?: string }
                const mapKey = opts['hc-key'] ?? ''
                const district = districtsByMapKey.get(mapKey)
                if (district && onDistrictClick) onDistrictClick(district)
              },
            },
          },
        },
      ],
    }
  }, [districts, districtsByMapKey, metric, nameToMapKey, onDistrictClick, showLabels])

  if (mapError || districts.length === 0) {
    return null
  }

  const metricMeta = METRIC_OPTIONS.find((m) => m.value === metric) ?? METRIC_OPTIONS[1]

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase text-moh-green">{title}</h2>
          <p className="mt-1 text-xs text-gray-600">
            Choropleth by district boundary · {matchedCount} of {districts.length} districts matched to map ISO keys
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <span className="font-semibold uppercase tracking-wide">Metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as UgandaMapMetric)}
              className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show district names
          </label>
        </div>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        Colour scale: <strong>{metricMeta.label}</strong>
        {metricMeta.isPercent ? ' (70–100%)' : ' (staff count)'} · districts without PMS data appear pale green ·
        click a district for detail
      </p>

      <HighchartsReact
        constructorType="mapChart"
        highcharts={Highcharts}
        options={options}
        callback={(chart: Highcharts.Chart | undefined) => {
          if (!chart) {
            setMapError(true)
          }
        }}
      />

      {matchedCount < districts.length ? (
        <p className="mt-2 text-xs text-amber-700">
          {districts.length - matchedCount} district(s) could not be matched to map boundaries — ensure ISO/map keys are
          seeded in the districts table.
        </p>
      ) : null}
    </Card>
  )
}
