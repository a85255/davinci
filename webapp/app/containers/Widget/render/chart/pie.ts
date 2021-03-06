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
  getTextWidth
} from '../../components/util'
import {
  getLegendOption,
  getLabelOption
} from './util'
import { EChartOption } from 'echarts'
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
    width,
    height,
    data,
    cols,
    metrics,
    chartStyles,
    color,
    tip
  } = chartProps

  const {
    label,
    legend,
    spec,
    toolbox
  } = chartStyles

  const {
    legendPosition,
    fontSize
  } = legend

  const {
    circle,
    roseType
  } = spec
  const { selectedItems } = drillOptions
  // formatter: '{b}({d}%)'
  const labelOption = {
    // label: getLabelOption('pie', label)
  }
  const roseTypeValue = roseType ? 'radius' : ''
  const radiusValue = (!circle && !roseType) || (!circle && roseType) ? `70%` : ['48%', '70%']

  let seriesObj = {}
  const seriesArr = []
  let legendData = []
  metrics.forEach((m) => {
    const decodedMetricName = decodeMetricName(m.name)
    if (cols.length || color.items.length) {
      const groupColumns = color.items.map((c) => c.name).concat(cols.map((c) => c.name))
      .reduce((distinctColumns, col) => {
        if (!distinctColumns.includes(col)) {
          distinctColumns.push(col)
        }
        return distinctColumns
      }, [])
      const grouped = data.reduce((obj, val) => {
        const groupingKey = groupColumns
          .reduce((keyArr, col) => keyArr.concat(val[col]), [])
          .join(String.fromCharCode(0))
        if (!obj[groupingKey]) {
          obj[groupingKey] = []
        }
        obj[groupingKey].push(val)
        return obj
      }, {})

      const seriesData = []
      Object.entries(grouped).forEach(([key, value]) => {
        const legendStr = key.replace(String.fromCharCode(0), ' ')
        legendData.push(legendStr)
        value.forEach((v) => {
          const obj = {
            name: legendStr,
            value: v[`${m.agg}(${decodedMetricName})`]
          }
          seriesData.push(obj)
        })
      })
      let leftValue
      let topValue
      const pieLeft = 56 + Math.max(...legendData.map((s) => getTextWidth(s, '', `${fontSize}px`)))
      switch (legendPosition) {
        case 'top':
          leftValue = width / 2
          topValue = (height + 32) / 2
          break
        case 'bottom':
          leftValue = width / 2
          topValue = (height - 32) / 2
          break
        case 'left':
          leftValue = (width + pieLeft) / 2
          topValue = height / 2
          break
        case 'right':
          leftValue = (width - pieLeft) / 2
          topValue = height / 2
          break
      }

      let colorArr = []
      let colorObj = {}
      if (color.items.length) {
        const colorvaluesObj = color.items[0].config.values
        colorObj = colorvaluesObj
        for (const keys in colorvaluesObj) {
          if (colorvaluesObj.hasOwnProperty(keys)) {
            colorArr.push(colorvaluesObj[keys])
          }
        }
      } else {
        colorArr = ['#509af2']
      }
      seriesObj = {
        name: '',
        type: 'pie',
        avoidLabelOverlap: true,
        center: legend.showLegend ? [leftValue, topValue] : [width / 2, height / 2],
        color: colorArr,
        data: seriesData.map((data, index) => {
          const itemStyleObj = selectedItems && selectedItems.length && selectedItems.some((item) => item === index) ? {itemStyle: {
            normal: {
              opacity: 1
            }
          }} : {}
          return {
            ...data,
            ...itemStyleObj
          }
        }),
        itemStyle: {
          emphasis: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
          },
          normal: {
            opacity: selectedItems && selectedItems.length > 0 ? 0.25 : 1,
            color: function (data) {
              return {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                    offset: 0, color: colorArr.length === 1  ? colorFormat(colorArr[0], .6) : colorFormat(colorObj[data.name], .6)// 0% 处的颜色
                }, {
                    offset: 1, color: colorArr.length === 1  ? colorFormat(colorArr[0], 1) : colorFormat(colorObj[data.name], 1) // 100% 处的颜色
                }],
                // global: false // 缺省为 false
              }
            }
          }
        },
        ...labelOption,
        roseType: roseTypeValue,
        radius: radiusValue
      }
    } else {
      legendData = []
      seriesObj = {
        name: decodedMetricName,
        type: 'pie',
        avoidLabelOverlap: true,
        center: [width / 2, height / 2],
        data: data.map((d, index) => {
          const itemStyleObj = selectedItems && selectedItems.length && selectedItems.some((item) => item === index) ? {itemStyle: {
            normal: {
              opacity: 1,
            }
          }} : {}
          return {
            name: decodedMetricName,
            value: d[`${m.agg}(${decodedMetricName})`],
            ...itemStyleObj
          }
        }),
        itemStyle: {
          emphasis: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
          },
          normal: {
            opacity: selectedItems && selectedItems.length > 0 ? 0.25 : 1,
          }
        },
        ...labelOption,
        roseType: roseTypeValue,
        radius: radiusValue
      }
    }
    seriesArr.push(seriesObj)
  })
  const tooltip: EChartOption.Tooltip = {
    trigger: 'item',
    formatter: '{b} <br/>{c} ({d}%)'
  }
  console.log(seriesArr)
  return {
    tooltip,
    legend: getLegendOption(legend, legendData),
    series: seriesArr
  }
}
