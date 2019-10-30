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
  getTextWidth,
  getAggregatorLocale
} from '../../components/util'
import {
  getLegendOption,
  getGridPositions,
  getDimetionAxisOption
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
let i = 0
export default function (chartProps: IChartProps, drillOptions) {
  const {
    width,
    height,
    data,
    cols,
    metrics,
    chartStyles
    // color,
    // tip
  } = chartProps

  const {
    legend,
    spec,
    doubleYAxis,
    xAxis,
    splitLine
  } = chartStyles

  const {
    legendPosition,
    fontSize
  } = legend

  const {
    stack,
    smooth,
    step,
    symbol,
    label
  } = spec

  const {
    yAxisLeft,
    yAxisRight,
    yAxisSplitNumber,
    dataZoomThreshold
  } = doubleYAxis

  const {
    labelColor,
    labelFontFamily,
    labelFontSize,
    lineColor,
    lineSize,
    lineStyle,
    showLabel,
    showLine,
    xAxisInterval,
    xAxisRotate
  } = xAxis

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

  const labelOption = {
    label: {
      normal: {
        show: label,
        position: 'top'
      }
    }
  }

  const { selectedItems } = drillOptions
  const { secondaryMetrics } = chartProps

  const seriesData = secondaryMetrics
    ? getAixsMetrics('metrics', metrics, data, stack, labelOption, selectedItems, {key: 'yAxisLeft', type: yAxisLeft})
      .concat(getAixsMetrics('secondaryMetrics', secondaryMetrics, data, stack, labelOption, selectedItems, {key: 'yAxisRight', type: yAxisRight}))
    : getAixsMetrics('metrics', metrics, data, stack, labelOption, selectedItems, {key: 'yAxisLeft', type: yAxisLeft})

  const seriesObj = {
    series: seriesData.map((series) => {
      if (series.type === 'line') {
        return {
          ...series,
          symbol: symbol ? 'emptyCircle' : 'none',
          smooth,
          step
        }
      } else {
        return series
      }
    })
  }

  let legendOption
  let gridOptions
  if (seriesData.length > 1) {
    const seriesNames = seriesData.map((s) => s.name)
    legendOption = {
      legend: getLegendOption(legend, seriesNames)
    }
    gridOptions = {
      grid: getGridPositions(legend, seriesNames, 'doubleYAxis', false)
    }
  }

  let leftMax
  let rightMax

  if (stack) {
    leftMax = metrics.reduce((num, m) => num + Math.max(...data.map((d) => d[`${m.agg}(${decodeMetricName(m.name)})`])), 0)
    rightMax = secondaryMetrics.reduce((num, m) => num + Math.max(...data.map((d) => d[`${m.agg}(${decodeMetricName(m.name)})`])), 0)
  } else {
    leftMax = Math.max(...metrics.map((m) => Math.max(...data.map((d) => d[`${m.agg}(${decodeMetricName(m.name)})`]))))
    rightMax = Math.max(...secondaryMetrics.map((m) => Math.max(...data.map((d) => d[`${m.agg}(${decodeMetricName(m.name)})`]))))
  }

  const leftInterval = getYaxisInterval(leftMax, (yAxisSplitNumber - 1))
  const rightInterval = rightMax > 0 ? getYaxisInterval(rightMax, (yAxisSplitNumber - 1)) : leftInterval

  const inverseOption = xAxis.inverse ? { inverse: true } : null

  const xAxisSplitLineConfig = {
    showLine: showVerticalLine,
    lineColor: verticalLineColor,
    lineSize: verticalLineSize,
    lineStyle: verticalLineStyle
  }
  const xAxisData = showLabel ? data.map((d) => d[cols[0].name]) : []

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {type: 'cross'}
    },
    xAxis: getDimetionAxisOption(xAxis, xAxisSplitLineConfig, xAxisData),
    yAxis: [
      {
        type: 'value',
        key: 'yAxisIndex0',
        min: 0,
        max: rightMax > 0 ? rightInterval * (yAxisSplitNumber - 1) : leftInterval * (yAxisSplitNumber - 1),
        interval: rightInterval,
        position: 'right',
        ...getDoubleYAxis(doubleYAxis)
      },
      {
        type: 'value',
        key: 'yAxisIndex1',
        min: 0,
        max: leftInterval * (yAxisSplitNumber - 1),
        interval: leftInterval,
        position: 'left',
        ...getDoubleYAxis(doubleYAxis)
      }
    ],
    ...seriesObj,
    ...gridOptions,
    ...legendOption
  }
  i = 0
  return option
}

export function getAixsMetrics (type, axisMetrics, data, stack, labelOption, selectedItems, axisPosition?: {key: string, type: string}) {
  const seriesNames = []
  const seriesAxis = []
  axisMetrics.forEach((m) => {
    const decodedMetricName = decodeMetricName(m.name)
    const localeMetricName = `[${getAggregatorLocale(m.agg)}] ${decodedMetricName}`
    seriesNames.push(decodedMetricName)
    const stackOption = stack && axisPosition.type === 'bar' && axisMetrics.length > 1 ? { stack: axisPosition.key } : null
    const itemData = data.map((g, index) => {
      const itemStyle = selectedItems && selectedItems.length && selectedItems.some((item) => item === index) ? {itemStyle: {normal: {opacity: 1, borderWidth: 6}}} : null
      return {
        value: g[`${m.agg}(${decodedMetricName})`],
        ...itemStyle
      }
    })

    seriesAxis.push({
      name: decodedMetricName,
      type: axisPosition && axisPosition.type ? axisPosition.type : type === 'metrics' ? 'line' : 'bar',
      ...stackOption,
      yAxisIndex: type === 'metrics' ? 1 : 0,
      data: itemData,
      ...labelOption,
      itemStyle: {
        normal: {
          opacity: selectedItems && selectedItems.length > 0 ? 0.25 : 1
        }
      },
      areaStyle: {
        normal: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
                offset: 1, color: colorFormat(defaultThemeColors[i], 0) // 0% 处的颜色
            }, {
                offset: 0, color: colorFormat(defaultThemeColors[i], 0.7) // 100% 处的颜色
            }],
            global: false // 缺省为 false
          }
        }
      },
    })
    i++
  })
  return seriesAxis
}

export function getYaxisInterval (max, splitNumber) {
  const roughInterval = parseInt(`${max / splitNumber}`, 10)
  const divisor = Math.pow(10, (`${roughInterval}`.length - 1))
  return (parseInt(`${roughInterval / divisor}`, 10) + 1) * divisor
}

export function getDoubleYAxis (doubleYAxis) {
  const {
    inverse,
    showLine,
    lineStyle,
    lineSize,
    lineColor,
    showLabel,
    labelFontFamily,
    labelFontSize,
    labelColor
  } = doubleYAxis

  return {
    inverse,
    axisLine: {
      show: showLine,
      lineStyle: {
        color: lineColor,
        width: Number(lineSize),
        type: lineStyle
      }
    },
    axisLabel: {
      show: showLabel,
      color: labelColor,
      fontFamily: labelFontFamily,
      fontSize: Number(labelFontSize),
      formatter: '{value}'
    }
  }
}
