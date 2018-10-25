import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers/lib/index'
import { buttonPrimary, Select, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { TextCell } from 'src/components/table'
import UriViewer from 'src/components/UriViewer'
import ReferenceData from 'src/data/reference-data'
import { ajaxCaller } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


export const renderDataCell = (data, namespace) => {
  const isUri = datum => _.startsWith('gs://', datum) || _.startsWith('dos://', datum)

  const renderCell = datum => h(TextCell, { title: datum },
    [isUri(datum) ? h(UriViewer, { uri: datum, googleProject: namespace }) : datum])

  return _.isObject(data) ?
    data.items.map((v, i) => h(Fragment, { key: i }, [
      renderCell(v.toString()), i < (data.items.length - 1) && div({ style: { marginRight: '0.5rem', color: colors.gray[1] } }, ',')
    ])) :
    renderCell(data && data.toString())
}

export const ReferenceDataImporter = ajaxCaller(class ReferenceDataImporter extends Component {
  static propTypes = {
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    namespace: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }

  render() {
    const { onDismiss, onSuccess, namespace, name, ajax: { Workspaces } } = this.props
    const { loading, selectedReference } = this.state

    return h(Modal, {
      onDismiss,
      title: 'Add Reference Data',
      okButton: buttonPrimary({
        disabled: !selectedReference || loading,
        onClick: () => {
          this.setState({ loading: true })
          Workspaces.workspace(namespace, name).shallowMergeNewAttributes(
            _.mapKeys(k => `referenceData-${selectedReference}-${k}`, ReferenceData[selectedReference])
          ).then(
            onSuccess,
            error => {
              reportError('Error importing reference data', error)
              onDismiss()
            }
          )
        }
      }, 'OK')
    }, [
      h(Select, {
        autoFocus: true,
        isSearchable: false,
        placeholder: 'Select data',
        value: selectedReference,
        onChange: ({ value }) => this.setState({ selectedReference: value }),
        options: _.keys(ReferenceData)
      }),
      loading && spinnerOverlay
    ])
  }
})

export const ReferenceDataDeleter = ajaxCaller(class ReferenceDataDeleter extends Component {
  static propTypes = {
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    namespace: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    referenceDataType: PropTypes.string.isRequired
  }

  render() {
    const { onDismiss, onSuccess, namespace, name, referenceDataType, ajax: { Workspaces } } = this.props
    const { deleting } = this.state

    return h(Modal, {
      onDismiss,
      title: 'Confirm Delete',
      okButton: buttonPrimary({
        disabled: deleting,
        onClick: async () => {
          this.setState({ deleting: true })
          try {
            await Workspaces.workspace(namespace, name).deleteAttributes(
              _.map(key => `referenceData-${referenceDataType}-${key}`, _.keys(ReferenceData[referenceDataType]))
            )
            onSuccess()
          } catch (error) {
            reportError('Error deleting reference data', error)
            onDismiss()
          }
        }
      }, ['Delete'])
    }, [`Are you sure you want to delete ${referenceDataType}?`])
  }
})

export const EntityDeleter = ajaxCaller(class EntityDeleter extends Component {
  static propTypes = {
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    namespace: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    selectedEntities: PropTypes.array.isRequired,
    selectedDataType: PropTypes.string.isRequired,
    runningSubmissionsCount: PropTypes.number.isRequired
  }

  constructor(props) {
    super(props)

    this.state = { additionalDeletions: [] }
  }

  async doDelete() {
    const { onDismiss, onSuccess, namespace, name, selectedEntities, selectedDataType, ajax: { Workspaces } } = this.props
    const { additionalDeletions } = this.state
    const entitiesToDelete = _.concat(_.map(entityName => ({ entityName, entityType: selectedDataType }), selectedEntities), additionalDeletions)

    this.setState({ deleting: true })

    try {
      await Workspaces.workspace(namespace, name).deleteEntities(entitiesToDelete)
      onSuccess()
    } catch (error) {
      switch (error.status) {
        case 409:
          this.setState({ additionalDeletions: _.filter(entity => entity.entityType !== selectedDataType, await error.json()), deleting: false })
          break
        default:
          reportError('Error deleting data entries', error)
          onDismiss()
      }
    }
  }

  render() {
    const { onDismiss, selectedEntities, runningSubmissionsCount } = this.props
    const { deleting, additionalDeletions } = this.state
    const moreToDelete = !!additionalDeletions.length

    const warningStyle = {
      border: `1px solid ${colors.orange[1]}`, borderLeft: 'none', borderRight: 'none',
      backgroundColor: colors.orange[4],
      padding: '1rem 1.25rem', margin: '0 -1.25rem',
      color: colors.orange[0], fontWeight: 'bold', fontSize: 12
    }

    return h(Modal, {
      onDismiss,
      title: 'Confirm Delete',
      okButton: buttonPrimary({
        disabled: deleting,
        onClick: () => this.doDelete()
      }, ['Delete'])
    }, [
      runningSubmissionsCount > 0 && div({ style: { ...warningStyle, display: 'flex', alignItems: 'center' } }, [
        icon('warning-standard', { size: 36, className: 'is-solid', style: { flex: 'none', marginRight: '0.5rem' } }),
        `WARNING: ${runningSubmissionsCount} workflows are currently running in this workspace. ` +
          'Deleting the following data could cause failures if a workflow is using this data.'
      ]),
      moreToDelete && div({ style: { ...warningStyle, display: 'flex', alignItems: 'center' } }, [
        icon('warning-standard', { size: 36, className: 'is-solid', style: { flex: 'none', marginRight: '0.5rem' } }),
        'In order to delete the selected data entries, the following entries that reference them must also be deleted.'
      ]),
      ..._.map(([i, entity]) => div({
        style: {
          borderTop: (i === 0 && runningSubmissionsCount === 0) ? undefined : Style.standardLine,
          padding: '0.6rem 1.25rem', margin: '0 -1.25rem'
        }
      }, moreToDelete ? `${entity.entityName} (${entity.entityType})` : entity),
      Utils.toIndexPairs(moreToDelete ? additionalDeletions : selectedEntities)),
      div({
        style: { ...warningStyle, textAlign: 'right' }
      }, [`${selectedEntities.length + additionalDeletions.length} data entries to be deleted.`]),
      deleting && spinnerOverlay
    ])
  }
})
