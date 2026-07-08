import { useMemo } from 'react'
import Highcharts from 'highcharts'
import { HighchartsReact } from 'highcharts-react-official'
import type { AttendanceTrends } from '@/types/dashboard'
import { Card } from '@/components/atoms/Card'

interface AttendanceTrendChartProps {
  trends: AttendanceTrends
  title?: string
}

export function AttendanceTrendChart({ trends, title = 'Attendance performance trend' }: AttendanceTrendChartProps) {
  const options = useMemo<Highcharts.Options>(
    () => ({
      chart: { backgroundColor: 'transparent', height: 320 },
      title: { text: undefined },
      credits: { enabled: false },
      xAxis: { categories: trends.labels, crosshair: true },
      yAxis: {
        min: 60,
        max: 100,
        title: { text: 'Attendance %' },
        plotLines: [
          {
            value: trends.target,
            color: '#D32F2F',
            dashStyle: 'Dash',
            width: 1,
            label: { text: `Target ${trends.target}%` },
          },
        ],
      },
      tooltip: { shared: true, valueSuffix: '%' },
      legend: { align: 'center', verticalAlign: 'bottom' },
      plotOptions: { column: { borderRadius: 4 } },
      series: [
        {
          type: 'column',
          name: 'HRM duty-station summaries',
          data: trends.series.hrm_duty_station,
          color: '#1565C0',
        },
        {
          type: 'column',
          name: 'PMS out-of-station GPS',
          data: trends.series.pms_out_of_station,
          color: '#F9A825',
        },
        {
          type: 'spline',
          name: 'Combined full record',
          data: trends.series.combined_full_record,
          color: '#2E7D32',
          lineWidth: 3,
          marker: { radius: 4 },
        },
      ],
    }),
    [trends],
  )

  return (
    <Card>
      <h2 className="mb-4 text-sm font-bold uppercase text-moh-green">{title}</h2>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </Card>
  )
}
