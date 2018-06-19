import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import { FlexTable, GridTable, paginator, TextCell } from 'src/components/table'
import { Rawls } from 'src/libs/ajax'
import { renderDataCell } from 'src/libs/data-utils'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import WorkspaceContainer from 'src/pages/workspaces/workspace/WorkspaceContainer'


const filterState = _.pick(['pageNumber', 'itemsPerPage', 'selectedDataType'])

const globalVariables = 'globalVariables'

const styles = {
  tableContainer: {
    display: 'flex', margin: '1rem', backgroundColor: 'white', borderRadius: 5,
    boxShadow: Style.standardShadow
  },
  dataTypeSelectionPanel: { flexShrink: 0, borderRight: `1px solid ${Style.colors.disabled}` },
  tableViewPanel: hasSelection => ({
    position: 'relative',
    overflow: 'hidden',
    margin: '1rem', width: '100%',
    textAlign: hasSelection ? undefined : 'center'
  }),
  dataModelHeading: {
    fontWeight: 500, padding: '0.5rem 1rem',
    borderBottom: `1px solid ${Style.colors.background}`
  },
  dataTypeOption: selected => ({
    cursor: 'pointer', padding: '0.75rem 1rem',
    backgroundColor: selected ? Style.colors.highlightFaded : null
  }),
  dataTypeIcon: { color: '#757575', marginRight: '0.5rem' }
}

class WorkspaceData extends Component {
  constructor(props) {
    super(props)

    this.state = { itemsPerPage: 25, pageNumber: 1, loading: false, ...StateHistory.get() }
  }

  async refresh() {
    const { namespace, name } = this.props

    try {
      const entityMetadata = await Rawls.workspace(namespace, name).entityMetadata()
      this.setState({ entityMetadata })

      if (this.state.selectedDataType) {
        this.loadData()
      }
    } catch (error) {
      reportError('Error loading workspace entity data', error)
    }
  }


  async loadData() {
    const { namespace, name } = this.props
    const { itemsPerPage, pageNumber, selectedDataType } = this.state

    try {
      this.setState({ loading: true, refreshRequested: false })

      if (selectedDataType === globalVariables) {
        const { workspace: { attributes } } = await Rawls.workspace(namespace, name).details()
        this.setState({
          workspaceAttributes: _.flow(
            _.toPairs,
            _.remove(([key]) => key === 'description' || key.includes(':'))
          )(attributes)
        })
      } else {
        const { results, resultMetadata: { unfilteredCount } } =
          await Rawls.workspace(namespace, name).paginatedEntitiesOfType(selectedDataType, { page: pageNumber, pageSize: itemsPerPage })
        this.setState({ entities: results, totalRowCount: unfilteredCount })
      }
    } catch (error) {
      reportError('Error loading workspace data', error)
    } finally {
      this.setState({ loading: false })
    }
  }

  componentDidMount() {
    this.refresh()
  }

  render() {
    const { selectedDataType, entityMetadata, loading } = this.state
    const { namespace, name } = this.props

    return h(WorkspaceContainer, {
      namespace, name,
      refresh: () => this.refresh(),
      breadcrumbs: breadcrumbs.commonPaths.workspaceDashboard({ namespace, name }),
      title: 'Data', activeTab: 'data'
    }, [
      div({ style: styles.tableContainer }, [
        !entityMetadata ? spinnerOverlay : h(Fragment, [
          div({ style: styles.dataTypeSelectionPanel }, [
            div({ style: styles.dataModelHeading }, 'Data Model'),
            !_.isEmpty(entityMetadata) && div({ style: { borderBottom: `1px solid ${Style.colors.background}` } },
              _.map(([type, typeDetails]) =>
                div({
                  style: styles.dataTypeOption(selectedDataType === type),
                  onClick: () => {
                    this.setState({ selectedDataType: type, pageNumber: 1, entities: undefined, refreshRequested: true })
                  }
                }, [
                  icon('table', { style: styles.dataTypeIcon }),
                  `${type} (${typeDetails.count})`
                ]),
              _.toPairs(entityMetadata))),
            div({
              style: {
                marginBottom: '1rem', ...styles.dataTypeOption(selectedDataType === globalVariables)
              },
              onClick: () => {
                this.setState({ selectedDataType: globalVariables, workspaceAttributes: undefined, refreshRequested: true })
              }
            }, [
              icon('world', { style: styles.dataTypeIcon }),
              'Global Variables'
            ])
          ]),
          div({ style: styles.tableViewPanel(selectedDataType) }, [
            selectedDataType ? this.renderData() : 'Select a data type.',
            loading && spinnerOverlay
          ])
        ])
      ])
    ])
  }

  renderData() {
    const { selectedDataType } = this.state

    if (selectedDataType === globalVariables) {
      return this.renderGlobalVariables()
    } else {
      return this.renderEntityTable()
    }
  }

  renderEntityTable() {
    const { namespace } = this.props
    const { entities, selectedDataType, entityMetadata, totalRowCount, pageNumber, itemsPerPage } = this.state

    return entities && h(Fragment, [
      h(AutoSizer, { disableHeight: true }, [
        ({ width }) => {
          return h(GridTable, {
            width, height: 500,
            rowCount: entities.length,
            columns: [
              {
                width: 150,
                headerRenderer: () => h(TextCell, `${selectedDataType}_id`),
                cellRenderer: ({ rowIndex }) => renderDataCell(entities[rowIndex].name, namespace)
              },
              ..._.map(name => ({
                width: 300,
                headerRenderer: () => h(TextCell, name),
                cellRenderer: ({ rowIndex }) => {
                  return renderDataCell(
                    Utils.entityAttributeText(entities[rowIndex].attributes[name]), namespace
                  )
                }
              }), entityMetadata[selectedDataType] ? entityMetadata[selectedDataType].attributeNames : [])
            ]
          })
        }
      ]),
      div({ style: { marginTop: '1rem' } }, [
        paginator({
          filteredDataLength: totalRowCount,
          pageNumber,
          setPageNumber: v => this.setState({ pageNumber: v }),
          itemsPerPage,
          setItemsPerPage: v => this.setState({ itemsPerPage: v, pageNumber: 1 })
        })
      ])
    ])
  }

  renderGlobalVariables() {
    const { namespace } = this.props
    const { workspaceAttributes } = this.state

    return Utils.cond(
      [!workspaceAttributes, () => undefined],
      [_.isEmpty(workspaceAttributes), () => 'No Global Variables defined'],
      () => h(AutoSizer, { disableHeight: true }, [
        ({ width }) => h(FlexTable, {
          width, height: 500, rowCount: workspaceAttributes.length,
          columns: [
            {
              size: { basis: 400, grow: 0 },
              headerRenderer: () => 'Name',
              cellRenderer: ({ rowIndex }) => renderDataCell(workspaceAttributes[rowIndex][0], namespace)
            },
            {
              size: { grow: 1 },
              headerRenderer: () => 'Value',
              cellRenderer: ({ rowIndex }) => renderDataCell(workspaceAttributes[rowIndex][1], namespace)
            }
          ]
        })
      ])
    )
  }

  componentDidUpdate(prevProps, prevState) {
    StateHistory.update(_.pick(
      ['entityMetadata', 'selectedDataType', 'entities', 'workspaceAttributes', 'totalRowCount', 'itemsPerPage', 'pageNumber'],
      this.state)
    )

    if (this.state.refreshRequested || !_.isEqual(filterState(prevState), filterState(this.state))) {
      this.loadData()
    }
  }
}

export const addNavPaths = () => {
  Nav.defPath('workspace-data', {
    path: '/workspaces/:namespace/:name/data',
    component: WorkspaceData
  })
}
