import Highcharts from 'highcharts/highmaps'
import mapModule from 'highcharts/modules/map'

const initMap = mapModule as unknown as (hc: typeof Highcharts) => void

try {
  if (typeof Highcharts.mapChart === 'undefined') {
    initMap(Highcharts)
  }
} catch (err) {
  console.error('Highcharts map module failed to load:', err)
}

export default Highcharts
