/*
 * <<
 * Davinci
 * ==
 * Copyright (C) 2016 - 2017 EDP
 * ==
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * >>
 */

import { IChartProps } from '../../components/Chart'
import {
  decodeMetricName,
  getChartTooltipLabel,
  getAggregatorLocale
} from '../../components/util'
import {
  getDimetionAxisOption,
  getMetricAxisOption,
  getLabelOption,
  getLegendOption,
  getGridPositions,
  makeGrouped,
  distinctXaxis
} from './util'
const defaultTheme = require('../../../../assets/json/echartsThemes/default.project.json')
const defaultThemeColors = defaultTheme.theme.color

function colorFormat (val, op){   //HEX十六进制颜色值转换为RGB(A)颜色值
  var a,b,c;
  if((/^#/g).test(val)){
      a = val.slice(1,3);
      b = val.slice(3,5);
      c = val.slice(5,7);
      return 'rgba(' + parseInt(a,16) + ',' + parseInt(b,16) + ',' + parseInt(c,16) + ',' + op + ')'
  } else {
      return false
  }
}
export default function (chartProps: IChartProps, drillOptions?: any) {
  const {
    data,
    cols,
    metrics,
    chartStyles,
    color,
    tip
  } = chartProps

  const {
    spec,
    xAxis,
    yAxis,
    splitLine,
    label,
    legend
  } = chartStyles

  const {
    showVerticalLine,
    verticalLineColor,
    verticalLineSize,
    verticalLineStyle,
    showHorizontalLine,
    horizontalLineColor,
    horizontalLineSize,
    horizontalLineStyle
  } = splitLine

  const {
    smooth,
    step
  } = spec

  const { selectedItems } = drillOptions

  const labelOption = {
    label: getLabelOption('line', label)
  }

  const xAxisColumnName = cols[0].name
  let xAxisData = data.map((d) => d[xAxisColumnName] || '')
  let grouped = {}
  if (color.items.length) {
    xAxisData = distinctXaxis(data, xAxisColumnName)
    grouped = makeGrouped(data, color.items.map((c) => c.name), xAxisColumnName, metrics, xAxisData)
  }

  const series = []
  const seriesData = []

  metrics.forEach((m, i) => {
    const decodedMetricName = decodeMetricName(m.name)
    const localeMetricName = `[${getAggregatorLocale(m.agg)}] ${decodedMetricName}`
    if (color.items.length) {
      Object
        .entries(grouped)
        .forEach(([k, v]: [string, any[]]) => {
          const serieObj = {
            name: `${k} ${localeMetricName}`,
            type: 'line',
            sampling: 'average',
            data: v.map((g, index) => {
              const itemStyleObj = selectedItems && selectedItems.length && selectedItems.some((item) => item === index) ? {itemStyle: {
                normal: {
                  opacity: 1,
                  borderWidth: 6
                }
              }} : {}
              // if (index === interactIndex) {
              //   return {
              //     value: g[m],
              //     itemStyle: {
              //       normal: {
              //         opacity: 1
              //       }
              //     }
              //   }
              // } else {
              // return g[`${m.agg}(${decodedMetricName})`]
              return {
                value: g[`${m.agg}(${decodedMetricName})`],
                ...itemStyleObj
              }
              // }
            }),
            itemStyle: {
              normal: {
                // opacity: interactIndex === undefined ? 1 : 0.25
                color: color.items[0].config.values[k],
                opacity: selectedItems && selectedItems.length > 0 ? 0.7 : 1
              }
            },
            // // 添加线阴影
            // lineStyle: {
            //   normal: {
            //       shadowColor: color.items[0].config.values[k],
            //       shadowBlur: 15,
            //       shadowOffsetY: 10
            //   }
            // },
            // // 添加区域阴影
            // areaStyle: {
            //   normal: {
            //     color: {
            //       type: 'linear',
            //       x: 0,
            //       y: 0,
            //       x2: 0,
            //       y2: 1,
            //       colorStops: [{
            //           offset: 0, color: 'red' // 0% 处的颜色
            //       }, {
            //           offset: 1, color: 'blue' // 100% 处的颜色
            //       }],
            //       global: false // 缺省为 false
            //     }
            //   }
            // },
            smooth,
            step,
            ...labelOption
          }
          series.push(serieObj)
          seriesData.push(grouped[k])
        })
    } else {
      const serieObj = {
        name: decodedMetricName,
        type: 'line',
        sampling: 'average',
        data: data.map((g, index) => {
          const itemStyleObj = selectedItems && selectedItems.length && selectedItems.some((item) => item === index) ? {itemStyle: {
            normal: {
              opacity: 1,
              borderWidth: 8
            }
          }} : {}
          // if (index === interactIndex) {
          //   return {
          //     value: d[m],
          //     lineStyle: {
          //       normal: {
          //         opacity: 1
          //       }
          //     },
          //     itemStyle: {
          //       normal: {
          //         opacity: 1
          //       }
          //     }
          //   }
          // } else {
          return {
            value: g[`${m.agg}(${decodedMetricName})`],
            ...itemStyleObj
          }
          // }
        }),
        // // 添加线阴影
        // lineStyle: {
        //   normal: {
        //       shadowColor: color.value[m.name] || defaultThemeColors[i],
        //       shadowBlur: 20,
        //       shadowOffsetY: 10
        //   }
        // },
        // 添加区域阴影
        areaStyle: {
          normal: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                  offset: 1, color: colorFormat(color.value[m.name] || defaultThemeColors[i], 0) // 0% 处的颜色
              }, {
                  offset: 0, color: colorFormat(color.value[m.name] || defaultThemeColors[i], .7) // 100% 处的颜色
              }],
              global: false // 缺省为 false
            }
          }
        },
        itemStyle: {
          normal: {
            // opacity: interactIndex === undefined ? 1 : 0.25
            color: color.value[m.name] || defaultThemeColors[i],
            opacity: selectedItems && selectedItems.length > 0 ? 0.7 : 1
          }
        },
        smooth,
        step,
        ...labelOption
      }
      series.push(serieObj)
      seriesData.push([...data])
    }
  })

  const seriesNames = series.map((s) => s.name)

  // dataZoomOptions = dataZoomThreshold > 0 && dataZoomThreshold < dataSource.length && {
  //   dataZoom: [{
  //     type: 'inside',
  //     start: Math.round((1 - dataZoomThreshold / dataSource.length) * 100),
  //     end: 100
  //   }, {
  //     start: Math.round((1 - dataZoomThreshold / dataSource.length) * 100),
  //     end: 100,
  //     handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
  //     handleSize: '80%',
  //     handleStyle: {
  //       color: '#fff',
  //       shadowBlur: 3,
  //       shadowColor: 'rgba(0, 0, 0, 0.6)',
  //       shadowOffsetX: 2,
  //       shadowOffsetY: 2
  //     }
  //   }]
  // }

  const xAxisSplitLineConfig = {
    showLine: showVerticalLine,
    lineColor: verticalLineColor,
    lineSize: verticalLineSize,
    lineStyle: verticalLineStyle
  }

  const yAxisSplitLineConfig = {
    showLine: showHorizontalLine,
    lineColor: horizontalLineColor,
    lineSize: horizontalLineSize,
    lineStyle: horizontalLineStyle
  }

  return {
    xAxis: getDimetionAxisOption(xAxis, xAxisSplitLineConfig, xAxisData),
    yAxis: getMetricAxisOption(yAxis, yAxisSplitLineConfig, metrics.map((m) => decodeMetricName(m.name)).join(` / `)),
    series,
    tooltip: {
      formatter: getChartTooltipLabel('line', seriesData, { cols, metrics, color, tip })
    },
    legend: getLegendOption(legend, seriesNames),
    grid: getGridPositions(legend, seriesNames, '', false, yAxis, xAxis, xAxisData)
  }
}
