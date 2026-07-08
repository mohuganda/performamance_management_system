import { useEffect, useMemo, useState } from 'react'
import { HighchartsReact } from 'highcharts-react-official'
import ugMap from '@highcharts/map-collection/countries/ug/ug-all.geo.json'
import Highcharts from '@/lib/highchartsMap'
import type { DistrictCoverage } from '@/types/dashboard'
import { Card } from '@/components/atoms/Card'

function rateColor(rate: number): string {
  if (rate >= 95) return '#2E7D32'
  if (rate >= 90) return '#66BB6A'
  if (rate >= 85) return '#F9A825'
  return '#D32F2F'
}

interface UgandaDistrictMapProps {
  districts: DistrictCoverage[]
  title?: string
}

export function UgandaDistrictMap({
  districts,
  title = 'Uganda — districts using PMS',
}: UgandaDistrictMapProps) {
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    setMapError(false)
  }, [districts])

  const options = useMemo<Highcharts.Options>(() => {
    const points = districts.map((d) => ({
      name: d.district,
      lat: d.lat,
      lon: d.lon,
      z: d.staff_count,
      combined: d.combined_rate,
      oos: d.oos_attendance_rate,
      hrm: d.hrm_summary_rate,
      color: rateColor(d.combined_rate),
    }))

    return {
      chart: { map: ugMap as Highcharts.GeoJSON, backgroundColor: 'transparent', height: 420 },
      title: { text: undefined },
      credits: { enabled: false },
      mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
      colorAxis: {
        min: 80,
        max: 100,
        stops: [
          [0, '#D32F2F'],
          [0.5, '#F9A825'],
          [1, '#2E7D32'],
        ],
      },
      legend: { enabled: false },
      tooltip: {
        headerFormat: '',
        pointFormat:
          '<b>{point.name}</b><br/>Staff on PMS: <b>{point.z}</b><br/>Combined attendance: <b>{point.combined}%</b><br/>OOS (PMS): {point.oos}% · HRM summary: {point.hrm}%',
      },
      series: [
        {
          type: 'map',
          name: 'Uganda',
          mapData: ugMap as Highcharts.GeoJSON,
          borderColor: '#2E7D32',
          borderWidth: 0.6,
          nullColor: '#E8F5E9',
          states: { hover: { color: '#C8E6C9' } },
          showInLegend: false,
        },
        {
          type: 'mappoint',
          name: 'District coverage',
          data: points,
          dataLabels: {
            enabled: true,
            format: '{point.name}',
            style: { fontSize: '9px', fontWeight: 'normal', textOutline: 'none' },
          },
        },
      ],
    }
  }, [districts])

  if (mapError || districts.length === 0) {
    return null
  }

  return (
    <Card>
      <h2 className="mb-2 text-sm font-bold uppercase text-moh-green">{title}</h2>
      <p className="mb-4 text-xs text-gray-600">
        Points show districts on PMS; colour reflects combined attendance (HRM summaries + out-of-station GPS).
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
    </Card>
  )
}
