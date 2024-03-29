import React, { Suspense } from 'react'
import { compose } from 'redux'
import { connect } from 'react-redux'
import { createStructuredSelector } from 'reselect'

import injectReducer from '../../../../utils/injectReducer'
import injectSaga from '../../../../utils/injectSaga'
import reducer from '../../reducer'
import viewReducer from '../../../View/reducer'
import saga from '../../sagas'
import viewSaga from '../../../View/sagas'
import formReducer from '../../../Dashboard/FormReducer'
import { hideNavigator } from '../../../App/actions'
import { ViewActions } from 'containers/View/actions'
const { loadViews, loadViewsDetail, loadViewData, loadViewDistinctValue } = ViewActions
import { addWidget, editWidget, loadWidgetDetail, clearCurrentWidget, executeComputed } from '../../actions'
import { makeSelectCurrentWidget, makeSelectLoading, makeSelectDataLoading, makeSelectDistinctColumnValues, makeSelectColumnValueLoading } from '../../selectors'
import { makeSelectViews, makeSelectFormedViews } from 'containers/View/selectors'

import { IViewBase, IFormedViews, IFormedView } from 'containers/View/types'
import OperatingPanel from './OperatingPanel'
import Widget, { IWidgetProps } from '../Widget'
import { IDataRequestParams } from 'app/containers/Dashboard/Grid'
import EditorHeader from '../../../../components/EditorHeader'
import WorkbenchSettingForm from './WorkbenchSettingForm'
import DashboardItemMask, { IDashboardItemMaskProps } from 'containers/Dashboard/components/DashboardItemMask'
import { DEFAULT_SPLITER, DEFAULT_CACHE_EXPIRED } from '../../../../globalConstants'
import { getStyleConfig } from 'containers/Widget/components/util'
import ChartTypes from '../../config/chart/ChartTypes'
import { message } from 'antd'
import 'assets/less/resizer.less'
import { IDistinctValueReqeustParams } from 'app/components/Filters'
import { IWorkbenchSettings, WorkbenchQueryMode } from './types'
const styles = require('./Workbench.less')

interface IWidget {
  id?: number
  name: string
  description: string
  type: number
  viewId: number
  projectId: number
  config: string
  publish: boolean
}

interface IWorkbenchProps {
  views: IViewBase[]
  formedViews: IFormedViews
  currentWidget: IWidget
  loading: boolean
  dataLoading: boolean
  distinctColumnValues: any[]
  columnValueLoading: boolean
  router: any
  params: { pid: string, wid: string }
  onHideNavigator: () => void
  onLoadViews: (projectId: number, resolve?: any) => void
  onLoadViewDetail: (viewId: number, resolve: () => void) => void
  onLoadWidgetDetail: (id: number) => void
  onLoadViewData: (viewId: number, requestParams: IDataRequestParams, resolve: (data: any) => void) => void
  onAddWidget: (widget: IWidget, resolve: () => void) => void
  onEditWidget: (widget: IWidget, resolve: () => void) => void
  onLoadViewDistinctValue: (viewId: number, params: IDistinctValueReqeustParams) => void
  onClearCurrentWidget: () => void
  onExecuteComputed: (sql: string) => void
}

interface IWorkbenchStates {
  id: number
  name: string
  description: string
  selectedViewId: number
  controls: any[]
  computed: any[]
  autoLoadData: boolean
  cache: boolean
  expired: number
  splitSize: number
  originalWidgetProps: IWidgetProps
  originalComputed: any[]
  widgetProps: IWidgetProps
  settingFormVisible: boolean
  settings: IWorkbenchSettings
}

const SplitPane = React.lazy(() => import('react-split-pane'))

export class Workbench extends React.Component<IWorkbenchProps, IWorkbenchStates> {

  private operatingPanel: OperatingPanel = null
  private defaultSplitSize = 440
  private maxSplitSize = this.defaultSplitSize * 1.5

  constructor (props) {
    super(props)
    const splitSize = +localStorage.getItem('workbenchSplitSize') || this.defaultSplitSize
    this.state = {
      id: 0,
      name: '',
      description: '',
      selectedViewId: null,
      controls: [],
      computed: [],
      originalComputed: [],
      cache: false,
      autoLoadData: true,
      expired: DEFAULT_CACHE_EXPIRED,
      splitSize,
      originalWidgetProps: null,
      widgetProps: {
        data: [],
        pagination: {
          pageNo: 0,
          pageSize: 0,
          totalCount: 0,
          withPaging: false
        },
        cols: [],
        rows: [],
        metrics: [],
        secondaryMetrics: [],
        filters: [],
        chartStyles: getStyleConfig({}),
        selectedChart: ChartTypes.Table,
        orders: [],
        mode: 'pivot',
        model: {},
        onPaginationChange: this.paginationChange
      },
      settingFormVisible: false,
      settings: this.initSettings()
    }
  }

  private placeholder = {
    name: '请输入Widget名称',
    description: '请输入描述…'
  }

  public componentWillMount () {
    const { params, onLoadViews, onLoadWidgetDetail } = this.props
    onLoadViews(Number(params.pid), () => {
      if (params.wid !== 'add' && !Number.isNaN(Number(params.wid))) {
        onLoadWidgetDetail(Number(params.wid))
      }
    })
  }

  public componentDidMount () {
    this.props.onHideNavigator()
  }

  public componentWillReceiveProps (nextProps: IWorkbenchProps) {
    const { currentWidget } = nextProps
    if (currentWidget && (currentWidget !== this.props.currentWidget)) {
      const { controls, cache, expired, computed, autoLoadData, ...rest } = JSON.parse(currentWidget.config)
      this.setState({
        id: currentWidget.id,
        name: currentWidget.name,
        description: currentWidget.description,
        controls,
        cache,
        autoLoadData: autoLoadData === undefined ? true : autoLoadData,
        expired,
        selectedViewId: currentWidget.viewId,
        originalWidgetProps: {...rest},
        widgetProps: {...rest},
        originalComputed: computed
      })
    }
  }

  public componentWillUnmount () {
    this.props.onClearCurrentWidget()
  }

  private initSettings = (): IWorkbenchSettings => {
    let workbenchSettings = {
      queryMode: WorkbenchQueryMode.Immediately,
      multiDrag: false
    }
    try {
      const loginUser = JSON.parse(localStorage.getItem('loginUser'))
      const currentUserWorkbenchSetting = JSON.parse(localStorage.getItem(`${loginUser.id}_workbench_settings`))
      if (currentUserWorkbenchSetting) {
        workbenchSettings = currentUserWorkbenchSetting
      }
    } catch (err) {
      throw new Error(err)
    }
    return workbenchSettings
  }

  private changeName = (e) => {
    this.setState({
      name: e.currentTarget.value
    })
  }

  private changeDesc = (e) => {
    this.setState({
      description: e.currentTarget.value
    })
  }

  private viewSelect = (viewId: number) => {
    const { formedViews } = this.props
    const nextState = {
      selectedViewId: viewId,
      controls: [],
      cache: false,
      expired: DEFAULT_CACHE_EXPIRED
    }
    if (formedViews[viewId]) {
      this.setState(nextState)
    } else {
      this.props.onLoadViewDetail(viewId, () => {
        this.setState(nextState)
      })
    }
  }

  private setControls = (controls: any[]) => {
    this.setState({
      controls
    })
  }

  private deleteComputed = (computeField) => {
    console.log({computeField})
    const { from } = computeField
    const { params, onEditWidget } = this.props
    const { id, name, description, selectedViewId, controls, cache, autoLoadData, expired, widgetProps, computed, originalWidgetProps, originalComputed } = this.state
    if (from === 'originalComputed') {
      this.setState({
        originalComputed: originalComputed.filter((oc) => oc.id !== computeField.id)
      }, () => {
        const {originalComputed, computed} = this.state
        const widget = {
          name,
          description,
          type: 1,
          viewId: selectedViewId,
          projectId: Number(params.pid),
          config: JSON.stringify({
            ...widgetProps,
            controls,
            computed: originalComputed && originalComputed ? [...computed, ...originalComputed] : [...computed],
            cache,
            autoLoadData,
            expired,
            data: []
          }),
          publish: true
        }
        if (id) {
          onEditWidget({...widget, id}, () => void 0)
        }
      })
    } else if (from === 'computed') {
      this.setState({
        computed: computed.filter((cm) => cm.id !== computeField.id)
      }, () => {
        const {originalComputed, computed} = this.state
        const widget = {
          name,
          description,
          type: 1,
          viewId: selectedViewId,
          projectId: Number(params.pid),
          config: JSON.stringify({
            ...widgetProps,
            controls,
            computed: originalComputed && originalComputed ? [...computed, ...originalComputed] : [...computed],
            cache,
            autoLoadData,
            expired,
            data: []
          }),
          publish: true
        }
        if (id) {
          onEditWidget({...widget, id}, () => void 0)
        }
      })
    }
  }

  private setComputed = (computeField) => {
    const {computed, originalComputed} = this.state
    const {from, sqlExpression} = computeField
    // todo  首先做sql合法校验； sqlExpression
    let isEdit = void 0
    let newComputed = null
    if (from === 'originalComputed') {
      isEdit = originalComputed ? originalComputed.some((cm) => cm.id === computeField.id) : false
      newComputed =  isEdit ? originalComputed.map((cm) => {
        if (cm.id === computeField.id) {
          return computeField
        } else {
          return cm
        }
      }) : originalComputed.concat(computeField)
      this.setState({
        originalComputed: newComputed
      })
    } else if (from === 'computed') {
      isEdit = computed.some((cm) => cm.id === computeField.id)
      newComputed =  isEdit ? computed.map((cm) => {
        if (cm.id === computeField.id) {
          return computeField
        } else {
          return cm
        }
      }) : computed.concat(computeField)
      this.setState({
        computed: newComputed
      })
    } else {
      this.setState({
        computed: computed.concat(computeField)
      })
    }
  }

  private cacheChange = (e) => {
    this.setState({
      cache: e.target.value
    })
  }

  private expiredChange = (value) => {
    this.setState({
      expired: value
    })
  }

  private setWidgetProps = (widgetProps: IWidgetProps) => {
    this.setState({
      widgetProps: {
        ...widgetProps,
        data: widgetProps.data || this.state.widgetProps.data
      }
    })
  }

  private saveWidget = () => {
    const { params, onAddWidget, onEditWidget } = this.props
    const { id, name, description, selectedViewId, controls, cache, expired, widgetProps, computed, originalWidgetProps, originalComputed, autoLoadData } = this.state
    if (!name.trim()) {
      message.error('Widget名称不能为空')
      return
    }
    if (!selectedViewId) {
      message.error('请选择一个View')
      return
    }
    const widget = {
      name,
      description,
      type: 1,
      viewId: selectedViewId,
      projectId: Number(params.pid),
      config: JSON.stringify({
        ...widgetProps,
        controls,
        computed: originalComputed && originalComputed ? [...computed, ...originalComputed] : [...computed],
        cache,
        expired,
        autoLoadData,
        data: []
      }),
      publish: true
    }
    console.info({
      widget
    })
    if (id) {
      onEditWidget({...widget, id}, () => {
        message.success('修改成功')
        const editSignDashboard = sessionStorage.getItem('editWidgetFromDashboard')
        const editSignDisplay = sessionStorage.getItem('editWidgetFromDisplay')
        if (editSignDashboard) {
          sessionStorage.removeItem('editWidgetFromDashboard')
          const [pid, portalId, portalName, dashboardId, itemId] = editSignDashboard.split(DEFAULT_SPLITER)
          this.props.router.replace(`/project/${pid}/portal/${portalId}/portalName/${portalName}/dashboard/${dashboardId}`)
        } else if (editSignDisplay) {
          sessionStorage.removeItem('editWidgetFromDisplay')
          const [pid, displayId] = editSignDisplay.split(DEFAULT_SPLITER)
          this.props.router.replace(`/project/${pid}/display/${displayId}`)
        } else {
          this.props.router.replace(`/project/${params.pid}/widgets`)
        }
      })
    } else {
      onAddWidget(widget, () => {
        message.success('添加成功')
        this.props.router.replace(`/project/${params.pid}/widgets`)
      })
    }
  }

  private cancel = () => {
    sessionStorage.removeItem('editWidgetFromDashboard')
    sessionStorage.removeItem('editWidgetFromDisplay')
    this.props.router.goBack()
  }

  private paginationChange = (pageNo: number, pageSize: number) => {
    this.operatingPanel.flipPage(pageNo, pageSize)
  }

  private chartStylesChange = (propPath: string[], value: string) => {
    const { widgetProps } = this.state
    const { chartStyles } = widgetProps
    const updatedChartStyles = { ...chartStyles }
    propPath.reduce((subObj, propName, idx) => {
      if (idx === propPath.length - 1) {
        subObj[propName] = value
      }
      return subObj[propName]
    }, updatedChartStyles)
    this.setWidgetProps({
      ...widgetProps,
      chartStyles: updatedChartStyles
    })
  }

  private saveSplitSize (newSize: number) {
    localStorage.setItem('workbenchSplitSize', newSize.toString())
  }

  private resizeChart = () => {
    this.setState({
      widgetProps: {
        ...this.state.widgetProps,
        renderType: 'resize'
      }
    })
  }


  private changeAutoLoadData = (e) => {
    this.setState({
      autoLoadData: e.target.value
    })
  }

  private openSettingForm = () => {
    this.setState({
      settingFormVisible: true
    })
  }

  private saveSettingForm = (values: IWorkbenchSettings) => {
    try {
      const loginUser = JSON.parse(localStorage.getItem('loginUser'))
      localStorage.setItem(`${loginUser.id}_workbench_settings`, JSON.stringify(values))
      this.setState({
        settings: values
      })
    } catch (err) {
      throw new Error(err)
    }
    this.closeSettingForm()
  }

  private closeSettingForm = () => {
    this.setState({
      settingFormVisible: false
    })
  }

  public render () {
    const {
      views,
      formedViews,
      loading,
      dataLoading,
      distinctColumnValues,
      columnValueLoading,
      onLoadViewData,
      onLoadViewDistinctValue
    } = this.props
    const {
      name,
      description,
      selectedViewId,
      controls,
      cache,
      autoLoadData,
      expired,
      computed,
      splitSize,
      originalWidgetProps,
      originalComputed,
      widgetProps,
      settingFormVisible,
      settings
    } = this.state
    const selectedView = formedViews[selectedViewId]
    const { queryMode, multiDrag } = settings

    const { selectedChart, cols, rows, metrics, data } = widgetProps
    const hasDataConfig = !!(cols.length || rows.length || metrics.length)
    const maskProps: IDashboardItemMaskProps = {
      loading: dataLoading,
      chartType: selectedChart,
      empty: !data.length,
      hasDataConfig
    }

    return (
      <div className={styles.workbench}>
        <EditorHeader
          currentType="workbench"
          className={styles.header}
          name={name}
          description={description}
          placeholder={this.placeholder}
          onNameChange={this.changeName}
          onDescriptionChange={this.changeDesc}
          onSave={this.saveWidget}
          onCancel={this.cancel}
          onSetting={this.openSettingForm}
          loading={loading}
        />
        <div className={styles.body}>
          <Suspense fallback={null}>
            <SplitPane
              split="vertical"
              defaultSize={splitSize}
              minSize={this.defaultSplitSize}
              maxSize={this.maxSplitSize}
              onChange={this.saveSplitSize}
              onDragFinished={this.resizeChart}
            >
              <OperatingPanel
                ref={(f) => this.operatingPanel = f}
                views={views}
                originalWidgetProps={originalWidgetProps}
                originalComputed={originalComputed}
                selectedView={selectedView}
                distinctColumnValues={distinctColumnValues}
                columnValueLoading={columnValueLoading}
                controls={controls}
                cache={cache}
                autoLoadData={autoLoadData}
                expired={expired}
                queryMode={queryMode}
                multiDrag={multiDrag}
                computed={computed}
                onViewSelect={this.viewSelect}
                onChangeAutoLoadData={this.changeAutoLoadData}
                onSetControls={this.setControls}
                onCacheChange={this.cacheChange}
                onExpiredChange={this.expiredChange}
                onSetWidgetProps={this.setWidgetProps}
                onSetComputed={this.setComputed}
                onDeleteComputed={this.deleteComputed}
                onLoadData={onLoadViewData}
                onLoadDistinctValue={onLoadViewDistinctValue}
              />
              <div className={styles.viewPanel}>
                <div className={styles.widgetBlock}>
                  <Widget
                    {...widgetProps}
                    loading={<DashboardItemMask.Loading {...maskProps}/>}
                    empty={<DashboardItemMask.Empty {...maskProps}/>}
                    editing={true}
                    onPaginationChange={this.paginationChange}
                    onChartStylesChange={this.chartStylesChange}
                  />
                </div>
              </div>
            </SplitPane>
          </Suspense>
          <WorkbenchSettingForm
            visible={settingFormVisible}
            settings={settings}
            onSave={this.saveSettingForm}
            onClose={this.closeSettingForm}
          />
        </div>
      </div>
    )
  }
}

const mapStateToProps = createStructuredSelector({
  views: makeSelectViews(),
  formedViews: makeSelectFormedViews(),
  currentWidget: makeSelectCurrentWidget(),
  loading: makeSelectLoading(),
  dataLoading: makeSelectDataLoading(),
  distinctColumnValues: makeSelectDistinctColumnValues(),
  columnValueLoading: makeSelectColumnValueLoading()
})

export function mapDispatchToProps (dispatch) {
  return {
    onHideNavigator: () => dispatch(hideNavigator()),
    onLoadViews: (projectId, resolve) => dispatch(loadViews(projectId, resolve)),
    onLoadViewDetail: (viewId, resolve) => dispatch(loadViewsDetail([viewId], resolve)),
    onLoadWidgetDetail: (id) => dispatch(loadWidgetDetail(id)),
    onLoadViewData: (viewId, requestParams, resolve) => dispatch(loadViewData(viewId, requestParams, resolve)),
    onAddWidget: (widget, resolve) => dispatch(addWidget(widget, resolve)),
    onEditWidget: (widget, resolve) => dispatch(editWidget(widget, resolve)),
    onLoadViewDistinctValue: (viewId, params) => dispatch(loadViewDistinctValue(viewId, params)),
    onClearCurrentWidget: () => dispatch(clearCurrentWidget()),
    onExecuteComputed: (sql) => dispatch(executeComputed(sql))
  }
}

const withConnect = connect<{}, {}>(mapStateToProps, mapDispatchToProps)

const withReducerWidget = injectReducer({ key: 'widget', reducer })
const withSagaWidget = injectSaga({ key: 'widget', saga })

const withReducerView = injectReducer({ key: 'view', reducer: viewReducer })
const withSagaView = injectSaga({ key: 'view', saga: viewSaga })

const withFormReducer = injectReducer({ key: 'form', reducer: formReducer })

export default compose(
  withReducerWidget,
  withReducerView,
  withFormReducer,
  withSagaView,
  withSagaWidget,
  withConnect
)(Workbench)
