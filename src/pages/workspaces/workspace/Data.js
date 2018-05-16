import _ from 'lodash'
import { div, h } from 'react-hyperscript-helpers'
import { icon, spinner } from 'src/components/icons'
import { DataTable } from 'src/components/table'
import { Rawls } from 'src/libs/ajax'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


export default class WorkspaceData extends Component {
  constructor(props) {
    super(props)

    this.state = StateHistory.get()
  }

  loadEntities(type) {
    const { namespace, name } = this.props.workspace

    Rawls.workspace(namespace, name).entity(type).then(
      selectedEntities => this.setState({ selectedEntities }),
      entityFailure => this.setState({ entityFailure })
    )
  }

  componentWillMount() {
    const { namespace, name } = this.props.workspace
    const { selectedEntityType } = this.state

    Rawls.workspace(namespace, name).entities().then(
      workspaceEntities => this.setState({ workspaceEntities }),
      entitiesFailure => this.setState({ entitiesFailure })
    )

    if (selectedEntityType) {
      this.loadEntities(selectedEntityType)
    }
  }

  render() {
    const { selectedEntityType, selectedEntities, workspaceEntities, entitiesFailure, entityFailure } = this.state

    const entityTypeList = () => _.map(workspaceEntities, (typeDetails, type) =>
      div({
        style: {
          cursor: 'pointer', padding: '0.75rem 1rem',
          backgroundColor: selectedEntityType === type ? Style.colors.highlightFaded : null
        },
        onClick: () => {
          this.setState({ selectedEntityType: type, selectedEntities: null })
          this.loadEntities(type)
        }
      },
      [
        icon('table', { style: { color: '#757575', marginRight: '0.5rem' } }),
        `${type} (${typeDetails.count})`
      ])
    )

    const entityTable = () => h(DataTable, {
      defaultItemsPerPage: this.state.itemsPerPage,
      onItemsPerPageChanged: itemsPerPage => this.setState({ itemsPerPage }),
      initialPage: this.state.pageNumber,
      onPageChanged: pageNumber => this.setState({ pageNumber }),
      dataSource: _.sortBy(selectedEntities, 'name'),
      tableProps: {
        rowKey: 'name',
        scroll: { x: true },
        columns: _.concat([{
          title: selectedEntityType + '_id',
          key: selectedEntityType + '_id',
          render: entity => entity.name
        }], _.map(workspaceEntities[selectedEntityType]['attributeNames'], name => {
          return {
            title: name,
            key: name,
            render: entity => entity.attributes[name]
          }
        }))
      }
    })


    return div({
      style: {
        display: 'flex', margin: '1rem', backgroundColor: 'white', borderRadius: 5,
        boxShadow: Style.standardShadow
      }
    },
    Utils.cond(
      [entitiesFailure, () => `Couldn't load workspace entities: ${entitiesFailure}`],
      [!workspaceEntities, () => [spinner({ style: { margin: '2rem auto' } })]],
      [
        _.isEmpty(workspaceEntities),
        () => [div({ style: { margin: '2rem auto' } }, 'There is no data in this workspace.')]
      ],
      () => [
        div({ style: { flexShrink: 0, borderRight: `1px solid ${Style.colors.disabled}` } }, [
          div({
            style: {
              fontWeight: 500, padding: '0.5rem 1rem',
              borderBottom: `1px solid ${Style.colors.background}`
            }
          }, 'Data Model'),
          div({ style: { marginBottom: '1rem' } }, entityTypeList())
        ]),
        div(
          {
            style: {
              overflow: 'hidden', margin: `1rem ${!selectedEntities ? 'auto' : ''}`
            }
          },
          [
            Utils.cond(
              [entityFailure, () => `Couldn't load ${selectedEntityType}s: ${entityFailure}`],
              [!selectedEntityType, 'Select a data type.'],
              [!selectedEntities, spinner],
              entityTable
            )
          ]
        )
      ]
    ))
  }

  componentDidUpdate() {
    const { workspaceEntities, selectedEntityType, itemsPerPage, pageNumber } = this.state
    StateHistory.update({ workspaceEntities, selectedEntityType, itemsPerPage, pageNumber })
  }
}
