import FileSaver from 'file-saver'
import _ from 'lodash/fp'
import { Component, Fragment, useEffect, useState } from 'react'
import { b, div, h, label, span } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import {
  ButtonPrimary, ButtonSecondary, Clickable, GroupedSelect, IdContainer, LabeledCheckbox, Link, methodLink, RadioButton, Select, spinnerOverlay
} from 'src/components/common'
import Dropzone from 'src/components/Dropzone'
import { centeredSpinner, icon } from 'src/components/icons'
import { DelayedAutocompleteTextArea, DelayedSearchInput, NumberInput } from 'src/components/input'
import { MarkdownViewer } from 'src/components/markdown'
import Modal from 'src/components/Modal'
import { InfoBox, makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import StepButtons from 'src/components/StepButtons'
import { HeaderCell, SimpleFlexTable, SimpleTable, Sortable, TextCell } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import WDLViewer from 'src/components/WDLViewer'
import { Ajax } from 'src/libs/ajax'
import colors, { terraSpecial } from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import { HiddenLabel } from 'src/libs/forms'
import * as Nav from 'src/libs/nav'
import { workflowSelectionStore } from 'src/libs/state'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import DataStepContent from 'src/pages/workspaces/workspace/workflows/DataStepContent'
import DeleteWorkflowModal from 'src/pages/workspaces/workspace/workflows/DeleteWorkflowModal'
import { chooseBaseType, chooseRootType, chooseSetType, processSnapshotTable } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType'
import ExportWorkflowModal from 'src/pages/workspaces/workspace/workflows/ExportWorkflowModal'
import LaunchAnalysisModal from 'src/pages/workspaces/workspace/workflows/LaunchAnalysisModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const sideMargin = '3rem'

const miniMessage = text => span({ style: { fontWeight: 500, fontSize: '75%', marginRight: '1rem', textTransform: 'uppercase' } }, [text])

const augmentErrors = ({ invalidInputs, invalidOutputs, missingInputs }) => {
  return {
    inputs: {
      ...invalidInputs,
      ..._.fromPairs(_.map(name => [name, 'This attribute is required'], missingInputs))
    },
    outputs: invalidOutputs
  }
}

const styles = {
  messageContainer: {
    height: '2.25rem',
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    bottom: '0.5rem',
    right: sideMargin
  },
  tabContents: {
    padding: `1rem ${sideMargin}`,
    backgroundColor: colors.dark(0.1)
  },
  cell: optional => ({
    fontWeight: !optional && 500,
    fontStyle: optional && 'italic'
  }),
  outputInfoLabel: {
    color: colors.dark()
  },
  placeholder: {
    fontStyle: 'italic'
  },
  checkBoxSpanMargins: {
    margin: '0 0.5rem 0 1rem'
  },
  checkBoxLeftMargin: {
    marginLeft: '1rem'
  }
}

const ioTask = ({ name }) => _.nth(-2, name.split('.'))
const ioVariable = ({ name }) => _.nth(-1, name.split('.'))
const ioType = ({ inputType, outputType }) => (inputType || outputType).match(/(.*?)\??$/)[1] // unify, and strip off trailing '?'

// Trim a config down based on what the `/inputsOutputs` endpoint says
const filterConfigIO = ({ inputs, outputs }) => {
  return _.flow(
    _.update('inputs', _.pick(_.map('name', inputs))),
    _.update('outputs', _.pick(_.map('name', outputs)))
  )
}

const WorkflowIOTable = ({ which, inputsOutputs: data, config, errors, onChange, onSetDefaults, onBrowse, suggestions, readOnly }) => {
  const [sort, setSort] = useState({ field: 'taskVariable', direction: 'asc' })

  const taskSort = o => ioTask(o).toLowerCase()
  const varSort = o => ioVariable(o).toLowerCase()
  const sortedData = _.orderBy(
    sort.field === 'taskVariable' ? ['optional', taskSort, varSort] : ['optional', varSort, taskSort],
    ['asc', sort.direction, sort.direction],
    data
  )

  return h(SimpleFlexTable, {
    'aria-label': `workflow ${which}`,
    rowCount: sortedData.length,
    noContentMessage: `No matching ${which}.`,
    sort, readOnly,
    columns: [
      {
        size: { basis: 350, grow: 0 },
        field: 'taskVariable',
        headerRenderer: () => h(Sortable, { sort, field: 'taskVariable', onSort: setSort }, [h(HeaderCell, ['Task name'])]),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex]
          return h(TextCell, { style: { fontWeight: 500 } }, [
            ioTask(io)
          ])
        }
      },
      {
        size: { basis: 360, grow: 0 },
        field: 'workflowVariable',
        headerRenderer: () => h(Sortable, { sort, field: 'workflowVariable', onSort: setSort }, ['Variable']),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex]
          return h(TextCell, { style: styles.cell(io.optional) }, [ioVariable(io)])
        }
      },
      {
        size: { basis: 160, grow: 0 },
        headerRenderer: () => h(HeaderCell, ['Type']),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex]
          return h(TextCell, { style: styles.cell(io.optional) }, [ioType(io)])
        }
      },
      {
        headerRenderer: () => h(Fragment, [
          div({ style: { fontWeight: 'bold' } }, ['Attribute']),
          !readOnly && which === 'outputs' && h(Fragment, [
            div({ style: { whiteSpace: 'pre' } }, ['  |  ']),
            h(Link, { onClick: onSetDefaults }, ['Use defaults'])
          ])
        ]),
        cellRenderer: ({ rowIndex }) => {
          const io = sortedData[rowIndex]
          const { name, optional, inputType } = io
          const value = config[which][name] || ''
          const error = errors[which][name]
          const isFile = (inputType === 'File') || (inputType === 'File?')
          const formattedValue = JSON.stringify(Utils.maybeParseJSON(value), null, 2)
          return div({ style: { display: 'flex', alignItems: 'center', width: '100%', paddingTop: '0.5rem', paddingBottom: '0.5rem' } }, [
            div({ style: { flex: 1, display: 'flex', position: 'relative', minWidth: 0 } }, [
              !readOnly ? h(IdContainer, [labelId => h(Fragment, [
                h(HiddenLabel, { id: labelId }, [`${ioTask(io)} ${ioVariable(io)} attribute`]),
                h(DelayedAutocompleteTextArea, {
                  autosize: true,
                  spellCheck: false,
                  placeholder: optional ? 'Optional' : 'Required',
                  value,
                  style: isFile ? { paddingRight: '2rem' } : undefined,
                  onChange: v => onChange(name, v),
                  suggestions,
                  labelId
                })
              ])]) : h(TextCell, { style: { flex: 1 } }, [value]),
              !readOnly && isFile && h(Clickable, {
                style: { position: 'absolute', right: '0.5rem', top: 0, bottom: 0, display: 'flex', alignItems: 'center' },
                onClick: () => onBrowse(name),
                tooltip: 'Browse bucket files',
                'aria-haspopup': 'dialog'
              }, [icon('folder-open', { size: 20 })])
            ]),
            !readOnly && h(Link, {
              style: { marginLeft: '0.25rem' },
              disabled: formattedValue === undefined || formattedValue === value,
              onClick: () => onChange(name, formattedValue),
              tooltip: Utils.cond(
                [formattedValue === undefined, () => 'Cannot format this value'],
                [formattedValue === value, () => 'Already formatted'],
                () => 'Reformat'
              ),
              useTooltipAsLabel: true
            }, ['{…}']),
            error && h(TooltipTrigger, { content: error }, [
              icon('error-standard', {
                size: 14, style: { marginLeft: '0.5rem', color: colors.warning(), cursor: 'help' }
              })
            ])
          ])
        }
      }
    ]
  })
}

const BucketContentModal = ({ workspace: { workspace: { namespace, bucketName } }, onSelect, onDismiss }) => {
  const [prefix, setPrefix] = useState('')
  const [prefixes, setPrefixes] = useState()
  const [objects, setObjects] = useState(undefined)
  const [loading, setLoading] = useState(false)

  const signal = Utils.useCancellation()

  const load = _.flow(
    Utils.withBusyState(setLoading),
    withErrorReporting('Error loading bucket data')
  )(async (newPrefix = prefix) => {
    const { items, prefixes: newPrefixes } = await Ajax(signal).Buckets.list(namespace, bucketName, newPrefix)
    setObjects(items)
    setPrefixes(newPrefixes)
    setPrefix(newPrefix)
  })

  Utils.useOnMount(() => { load() })

  useEffect(() => {
    StateHistory.update({ objects, prefix })
  }, [objects, prefix])

  const prefixParts = _.dropRight(1, prefix.split('/'))
  return h(Modal, {
    onDismiss,
    title: 'Choose input file',
    showX: true,
    showButtons: false
  }, [
    div([
      _.map(({ label, target }) => {
        return h(Fragment, { key: target }, [
          h(Link, { onClick: () => load(target) }, [label]),
          ' / '
        ])
      }, [
        { label: 'Files', target: '' },
        ..._.map(n => {
          return { label: prefixParts[n], target: _.map(s => `${s}/`, _.take(n + 1, prefixParts)).join('') }
        }, _.range(0, prefixParts.length))
      ])
    ]),
    div({ style: { margin: '1rem -1rem 1rem -1rem', borderBottom: `1px solid ${colors.light(0.4)}` } }),
    h(SimpleTable, {
      'aria-label': 'file browser',
      columns: [
        { header: h(HeaderCell, ['Name']), size: { grow: 1 }, key: 'name' }
      ],
      rows: [
        ..._.map(p => {
          return {
            name: h(TextCell, [
              h(Link, { onClick: () => load(p) }, [p.slice(prefix.length)])
            ])
          }
        }, prefixes),
        ..._.map(({ name }) => {
          return {
            name: h(TextCell, [
              h(Link, { onClick: () => onSelect(`"gs://${bucketName}/${name}"`) }, [
                name.slice(prefix.length)
              ])
            ])
          }
        }, objects)
      ]
    }),
    (loading) && spinnerOverlay
  ])
}

const DocumentationCollapse = ({ children }) => {
  const [isOpened, setIsOpened] = useState(false)

  return div({
    style: { display: 'flex', margin: '0.5rem 0' },
    onClick: () => setIsOpened(!isOpened)
  }, [
    icon(isOpened ? 'angle-down' : 'angle-right', { style: { marginRight: '0.5rem', color: colors.accent() }, size: 21 }),
    isOpened ?
      h(MarkdownViewer, { style: { marginBottom: '1rem' } }, [children]) :
      div({ style: { width: '100%', ...Style.noWrapEllipsis } }, [children])
  ])
}

const isSet = _.endsWith('_set')

const findPossibleSets = listOfExistingEntities => {
  return _.reduce((acc, entityType) => {
    return isSet(entityType) || _.includes(`${entityType}_set`, listOfExistingEntities) ?
      acc :
      Utils.append(`${entityType}_set`, acc)
  }, [], listOfExistingEntities)
}

const WorkflowView = _.flow(
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceTab(props, 'workflows'),
    title: _.get('workflowName'), activeTab: 'workflows'
  }),
  Utils.withCancellationSignal
)(class WorkflowView extends Component {
  resetSelectionModel(value, selectedEntities = {}, entityMetadata = this.state.entityMetadata, isSnapshot) {
    const { workflowName } = this.props
    return {
      type: Utils.cond(
        [isSnapshot, () => processSnapshotTable],
        [_.has(value, entityMetadata), () => chooseRootType],
        () => chooseBaseType
      ),
      selectedEntities,
      newSetName: Utils.sanitizeEntityName(`${workflowName}_${new Date().toISOString().slice(0, -5)}`)
    }
  }

  constructor(props) {
    super(props)

    this.state = {
      activeTab: 'inputs',
      entitySelectionModel: { selectedEntities: {} },
      useCallCache: true,
      deleteIntermediateOutputFiles: false,
      useReferenceDisks: false,
      retryWithMoreMemory: false,
      retryMemoryFactor: 1.2,
      includeOptionalInputs: true,
      filter: '',
      errors: { inputs: {}, outputs: {} },
      ...StateHistory.get()
    }
  }

  isSingle() { return !this.isMultiple() }

  isMultiple() { return !this.state.processSingle }

  selectSingle() {
    const { modifiedConfig } = this.state
    this.setState({
      processSingle: true,
      modifiedConfig: _.omit('rootEntityType', modifiedConfig)
    })
  }

  selectMultiple() {
    const { modifiedConfig, selectedEntityType } = this.state
    this.setState({
      processSingle: false,
      modifiedConfig: { ...modifiedConfig, rootEntityType: selectedEntityType }
    })
  }

  updateSingleOrMultipleRadioState(config) {
    this.setState({
      processSingle: !config.rootEntityType,
      selectedEntityType: config.dataReferenceName || config.rootEntityType
    })
  }

  /** Returns the href link for the specified article. */
  getSupportLink(article) { return `https://support.terra.bio/hc/en-us/articles/${article}` }

  render() {
    // isFreshData: controls spinnerOverlay on initial load
    // variableSelected: field of focus for bucket file browser
    // savedConfig: unmodified copy of config for checking for unsaved edits
    // modifiedConfig: active data, potentially unsaved
    const {
      isFreshData, savedConfig, launching, activeTab, useCallCache, deleteIntermediateOutputFiles, useReferenceDisks,
      retryWithMoreMemory, retryMemoryFactor, entitySelectionModel, variableSelected, modifiedConfig, updatingConfig,
      selectedSnapshotEntityMetadata, availableSnapshots
    } = this.state
    const { namespace, name, workspace } = this.props
    const workspaceId = { namespace, name }

    return h(Fragment, [
      savedConfig && h(Fragment, [
        this.renderSummary(),
        Utils.switchCase(activeTab,
          ['wdl', () => this.renderWDL()],
          ['inputs', () => this.renderIOTable('inputs')],
          ['outputs', () => this.renderIOTable('outputs')]
        ),
        launching && h(LaunchAnalysisModal, {
          workspace, config: savedConfig, entityMetadata: selectedSnapshotEntityMetadata,
          accessLevel: workspace.accessLevel, bucketName: workspace.workspace.bucketName,
          processSingle: this.isSingle(), entitySelectionModel, useCallCache, deleteIntermediateOutputFiles,
          useReferenceDisks, retryWithMoreMemory, retryMemoryFactor,
          onDismiss: () => this.setState({ launching: false }),
          onSuccess: submissionId => {
            const { methodRepoMethod: { methodVersion, methodNamespace, methodName, methodPath, sourceRepo } } = modifiedConfig
            // will only match if the current root entity type comes from a snapshot
            const snapshot = _.find({ name: modifiedConfig.dataReferenceName }, availableSnapshots)
            Ajax().Metrics.captureEvent(Events.workflowLaunch, {
              ...extractWorkspaceDetails(workspace),
              snapshotId: snapshot?.reference.snapshot,
              referenceId: snapshot?.referenceId,
              methodVersion,
              sourceRepo,
              methodPath: sourceRepo === 'agora' ? `${methodNamespace}/${methodName}` : methodPath
            })
            Nav.goToPath('workspace-submission-details', { submissionId, ...workspaceId })
          }
        }),
        variableSelected && h(BucketContentModal, {
          workspace,
          onDismiss: () => this.setState({ variableSelected: undefined }),
          onSelect: v => {
            this.setState({ modifiedConfig: _.set(['inputs', variableSelected], v, modifiedConfig), variableSelected: undefined })
          }
        })
      ]),
      (!isFreshData || updatingConfig) && spinnerOverlay
    ])
  }

  async getValidation() {
    const { namespace, name, workflowNamespace, workflowName, signal } = this.props

    try {
      return await Ajax(signal).Workspaces.workspace(namespace, name).methodConfig(workflowNamespace, workflowName).validate()
    } catch (e) {
      if (e.status === 404) {
        return false
      } else {
        throw e
      }
    }
  }

  async componentDidMount() {
    const {
      namespace, name, workflowNamespace, workflowName,
      workspace: { workspace: { attributes } },
      signal,
      queryParams: { selectionKey }
    } = this.props

    try {
      const ws = Ajax(signal).Workspaces.workspace(namespace, name)

      const [entityMetadata, validationResponse, config] = await Promise.all([
        ws.entityMetadata(),
        this.getValidation(),
        ws.methodConfig(workflowNamespace, workflowName).get()
      ])
      const { methodRepoMethod: { methodNamespace, methodName, sourceRepo, methodPath } } = config
      const isRedacted = !validationResponse

      const inputsOutputs = isRedacted ? {} : await Ajax(signal).Methods.configInputsOutputs(config)
      const selection = workflowSelectionStore.get()
      const readSelection = selectionKey && selection.key === selectionKey

      const { resources: snapshots } = await Ajax(signal).Workspaces.workspace(namespace, name).listSnapshots(1000, 0)

      // Dockstore users who target floating tags can change their WDL via Github without explicitly selecting a new version in Terra.
      // Before letting the user edit the config we retrieved from the DB, drop any keys that are no longer valid. [WA-291]
      // N.B. this causes `config` and `modifiedConfig` to be unequal, so we (accurately) prompt the user to save before launching
      // DO NOT filter when a config is redacted, when there's no IO from the WDL we would erase the user's inputs
      const modifiedConfig = _.flow(
        readSelection ? _.set('rootEntityType', selection.entityType) : _.identity,
        !isRedacted ? filterConfigIO(inputsOutputs) : _.identity
      )(config)

      const selectedSnapshotEntityMetadata = modifiedConfig.dataReferenceName ?
        await Ajax(signal).Workspaces.workspace(namespace, name).snapshotEntityMetadata(namespace, modifiedConfig.dataReferenceName) :
        undefined

      this.setState({
        savedConfig: config, modifiedConfig,
        currentSnapRedacted: isRedacted, savedSnapRedacted: isRedacted,
        entityMetadata,
        availableSnapshots: _.sortBy(_.lowerCase, snapshots),
        selectedSnapshotEntityMetadata,
        savedInputsOutputs: inputsOutputs,
        modifiedInputsOutputs: inputsOutputs,
        errors: isRedacted ? { inputs: {}, outputs: {} } : augmentErrors(validationResponse),
        entitySelectionModel: this.resetSelectionModel(
          modifiedConfig.dataReferenceName || modifiedConfig.rootEntityType,
          readSelection ? selection.entities : {},
          entityMetadata, !!modifiedConfig.dataReferenceName
        ),
        workspaceAttributes: _.flow(
          _.without(['description']),
          _.remove(s => s.includes(':'))
        )(_.keys(attributes))
      })

      if (sourceRepo === 'agora') {
        const methods = await Ajax(signal).Methods.list({ namespace: methodNamespace, name: methodName })
        const snapshotIds = _.map('snapshotId', methods)

        this.setState({ versionIds: snapshotIds })
      } else if (sourceRepo === 'dockstore' || sourceRepo === 'dockstoretools') {
        const versions = await Ajax(signal).Dockstore.getVersions({ path: methodPath, isTool: sourceRepo === 'dockstoretools' })
        const versionIds = _.map('name', versions)

        this.setState({ versionIds })
      } else {
        throw new Error('unknown sourceRepo')
      }

      this.updateSingleOrMultipleRadioState(modifiedConfig)
      this.fetchInfo(config, isRedacted)
    } catch (error) {
      reportError('Error loading data', error)
    } finally {
      this.setState({ isFreshData: true })
    }
  }

  componentDidUpdate() {
    StateHistory.update(_.pick([
      'savedConfig', 'modifiedConfig', 'entityMetadata', 'savedInputsOutputs', 'modifiedInputsOutputs', 'invalid', 'activeTab', 'wdl',
      'currentSnapRedacted', 'savedSnapRedacted'
    ], this.state))
  }

  async fetchInfo(savedConfig, currentSnapRedacted) {
    const { methodRepoMethod: { sourceRepo, methodNamespace, methodName, methodVersion, methodPath } } = savedConfig
    const { signal } = this.props
    try {
      if (sourceRepo === 'agora') {
        if (!currentSnapRedacted) {
          const { synopsis, documentation, payload } = await Ajax(signal).Methods.method(methodNamespace, methodName, methodVersion).get()
          this.setState({ synopsis, documentation, wdl: payload })
        }
      } else if (sourceRepo === 'dockstore' || sourceRepo === 'dockstoretools') {
        const wdl = await Ajax(signal).Dockstore.getWdl({ path: methodPath, version: methodVersion, isTool: sourceRepo === 'dockstoretools' })
        this.setState({ wdl })
      } else {
        throw new Error('unknown sourceRepo')
      }
    } catch (error) {
      reportError('Error loading WDL', error)
    }
  }

  describeSelectionModel() {
    const { modifiedConfig: { rootEntityType }, entitySelectionModel: { newSetName, selectedEntities, type } } = this.state
    const count = _.size(selectedEntities)
    const newSetMessage = t => `(will create a new ${t} named "${newSetName}")`
    const baseEntityType = isSet(rootEntityType) ? rootEntityType.slice(0, -4) : rootEntityType
    const setType = `${rootEntityType}_set`
    const pluralS = count > 1 ? 's' : ''
    return Utils.cond(
      [this.isSingle() || !rootEntityType, () => ''],
      [!count, () => 'No data selected'],
      [type === chooseSetType, () => `${rootEntityType}s from ${count} ${setType}${pluralS} ${count > 1 ? newSetMessage(setType) : ''}`],
      [type === chooseBaseType, () => `1 ${rootEntityType} containing ${count} ${baseEntityType}${pluralS} ${newSetMessage(rootEntityType)}`],
      [type === chooseRootType, () => `${count} selected ${rootEntityType}${pluralS} ${count > 1 ? newSetMessage(setType) : ''}`],
      [type === processSnapshotTable, () => `process entire snapshot table`]
    )
  }

  canSave() {
    const { modifiedConfig: { rootEntityType } } = this.state
    return this.isSingle() || !!rootEntityType
  }

  loadNewMethodConfig = _.flow(
    withErrorReporting('Error updating config'),
    Utils.withBusyState(v => this.setState({ updatingConfig: v }))
  )(async newSnapshotId => {
    const { signal } = this.props
    const { modifiedConfig: { methodRepoMethod: { methodNamespace, methodName, methodPath, sourceRepo } }, currentSnapRedacted } = this.state
    const config = await Ajax(signal).Methods.template({ methodNamespace, methodName, methodPath, sourceRepo, methodVersion: newSnapshotId })
    const modifiedInputsOutputs = await Ajax(signal).Methods.configInputsOutputs(config)
    this.setState(
      { modifiedInputsOutputs, savedSnapRedacted: currentSnapRedacted, currentSnapRedacted: false })
    this.setState(_.update('modifiedConfig', _.flow(
      _.set('methodRepoMethod', config.methodRepoMethod),
      filterConfigIO(modifiedInputsOutputs)
    )))
    this.fetchInfo(config)
  })


  renderSummary() {
    const { signal, workspace: ws, workspace: { workspace }, namespace, name: workspaceName } = this.props
    const {
      modifiedConfig, savedConfig, saving, saved, exporting, copying, deleting, selectingData, activeTab, errors, synopsis, documentation,
      availableSnapshots, selectedSnapshotEntityMetadata, selectedEntityType, entityMetadata, entitySelectionModel, versionIds = [], useCallCache,
      deleteIntermediateOutputFiles, useReferenceDisks, retryWithMoreMemory, retryMemoryFactor, currentSnapRedacted, savedSnapRedacted, wdl
    } = this.state
    const { name, methodRepoMethod: { methodPath, methodVersion, methodNamespace, methodName, sourceRepo }, rootEntityType } = modifiedConfig
    const entityTypes = _.keys(entityMetadata)
    const possibleSetTypes = findPossibleSets(entityTypes)
    const modified = !_.isEqual(modifiedConfig, savedConfig)
    const noLaunchReason = Utils.cond(
      [saving || modified, () => 'Save or cancel to Launch Analysis'],
      [
        entitySelectionModel.type === processSnapshotTable && (!rootEntityType || !(modifiedConfig.dataReferenceName)),
        () => 'A snapshot and table must be selected'
      ],
      [!_.isEmpty(errors.inputs) || !_.isEmpty(errors.outputs), () => 'At least one required attribute is missing or invalid'],
      [
        entitySelectionModel.type !== processSnapshotTable && this.isMultiple() &&
        (!entityMetadata[rootEntityType] && !_.includes(rootEntityType, possibleSetTypes)),
        () => `There are no ${selectedEntityType}s in this workspace.`
      ],
      [
        entitySelectionModel.type !== processSnapshotTable && this.isMultiple() && !_.size(entitySelectionModel.selectedEntities),
        () => 'Select data for analysis'
      ]
    )

    const inputsValid = _.isEmpty(errors.inputs)
    const outputsValid = _.isEmpty(errors.outputs)
    const sourceDisplay = sourceRepo === 'agora' ? `${methodNamespace}/${methodName}/${methodVersion}` : `${methodPath}:${methodVersion}`
    const clickToLearnMore = 'Click here to learn more.'
    return div({
      style: {
        position: 'relative',
        backgroundColor: 'white', borderBottom: `2px solid ${terraSpecial()}`,
        boxShadow: '0 2px 5px 0 rgba(0,0,0,0.26), 0 2px 10px 0 rgba(0,0,0,0.16)'
      }
    }, [
      div({ style: { display: 'flex', padding: `0.5rem ${sideMargin} 0`, minHeight: 120 } }, [
        div({ style: { flex: '1', lineHeight: '1.5rem', minWidth: 0 } }, [
          h(Link, {
            href: Nav.getLink('workspace-workflows', { namespace, name: workspaceName }),
            style: { display: 'inline-flex', alignItems: 'center', padding: '0.5rem 0' }
          }, [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Back to list']),
          div({ style: { display: 'flex' } }, [
            span({ style: { marginLeft: '-2rem', width: '2rem' } }, [
              h(MenuTrigger, {
                closeOnClick: true,
                content: h(Fragment, [
                  h(MenuButton, {
                    onClick: () => this.setState({ exporting: true })
                  }, [makeMenuIcon('export'), 'Copy to Another Workspace']),
                  h(MenuButton, {
                    onClick: () => this.setState({ copying: true })
                  }, [makeMenuIcon('copy'), 'Duplicate']),
                  h(MenuButton, {
                    disabled: !!Utils.editWorkspaceError(ws),
                    tooltip: Utils.editWorkspaceError(ws),
                    tooltipSide: 'right',
                    onClick: () => this.setState({ deleting: true })
                  }, [makeMenuIcon('trash'), 'Delete'])
                ])
              }, [
                h(Link, { 'aria-label': 'Workflow menu' }, [icon('cardMenuIcon', { size: 22 })])
              ])
            ]),
            span({ style: { color: colors.dark(), fontSize: 24 } }, name)
          ]),
          currentSnapRedacted && div({ style: { color: colors.warning(), fontSize: 16, fontWeight: 500, marginTop: '0.5rem' } }, [
            'You do not have access to this workflow, or this snapshot has been removed. To use this workflow, contact the owner to request access, or select another snapshot.'
          ]),
          h(IdContainer, [id => div({ style: { marginTop: '0.5rem' } }, [
            label({ htmlFor: id }, [`${sourceRepo === 'agora' ? 'Snapshot' : 'Version'}: `]),
            div({ style: { display: 'inline-block', marginLeft: '0.25rem', width: sourceRepo === 'agora' ? 75 : 200 } }, [
              h(Select, {
                id,
                isDisabled: !!Utils.editWorkspaceError(ws),
                isClearable: false,
                isSearchable: false,
                value: methodVersion,
                options: _.sortBy(sourceRepo === 'agora' ? _.toNumber : _.identity,
                  _.uniq([...versionIds, savedConfig.methodRepoMethod.methodVersion])),
                isOptionDisabled: ({ value }) => (currentSnapRedacted || savedSnapRedacted) &&
                  (value === savedConfig.methodRepoMethod.methodVersion),
                onChange: chosenSnapshot => this.loadNewMethodConfig(chosenSnapshot.value)
              })
            ])
          ])]),
          div([
            'Source: ', currentSnapRedacted ? sourceDisplay : h(Link, {
              href: methodLink(modifiedConfig),
              ...Utils.newTabLinkProps
            }, [sourceDisplay])
          ]),
          div(`Synopsis: ${synopsis ? synopsis : ''}`),
          !!documentation ?
            h(DocumentationCollapse, [documentation]) :
            div({ style: { fontStyle: 'italic', ...styles.description } }, ['No documentation provided']),
          div({ role: 'radiogroup', 'aria-label': 'Select number of target entities', style: { marginBottom: '1rem' } }, [
            div([
              h(RadioButton, {
                disabled: !!Utils.editWorkspaceError(ws) || currentSnapRedacted,
                text: 'Run workflow with inputs defined by file paths',
                name: 'process-workflows',
                checked: this.isSingle(),
                onChange: () => this.selectSingle(),
                labelStyle: { marginLeft: '0.5rem' }
              })
            ]),
            div([
              h(RadioButton, {
                disabled: !!Utils.editWorkspaceError(ws) || currentSnapRedacted,
                text: 'Run workflow(s) with inputs defined by data table',
                name: 'process-workflows',
                checked: this.isMultiple(),
                onChange: () => this.selectMultiple(),
                labelStyle: { marginLeft: '0.5rem' }
              })
            ]),
            this.isMultiple() && div({ style: { display: 'flex', margin: '0.5rem 0 0 2rem' } }, [
              div([
                div({ style: { height: '2rem', fontWeight: 'bold' } }, ['Step 1']),
                label(['Select root entity type:']),
                h(GroupedSelect, {
                  'aria-label': 'Entity type selector',
                  isClearable: false,
                  isDisabled: currentSnapRedacted || this.isSingle() || !!Utils.editWorkspaceError(ws),
                  isSearchable: true,
                  placeholder: 'Select data type...',
                  styles: { container: old => ({ ...old, display: 'inline-block', width: 200, marginLeft: '0.5rem' }) },
                  value: selectedEntityType,
                  onChange: async ({ value, source }) => {
                    if (source === 'snapshot') {
                      const selectedSnapshotEntityMetadata = await Ajax(signal)
                        .Workspaces
                        .workspace(namespace, workspaceName)
                        .snapshotEntityMetadata(namespace, value)

                      this.setState(_.set(['modifiedConfig', 'dataReferenceName'], value))
                      this.setState(_.unset(['modifiedConfig', 'rootEntityType']))

                      this.setState({
                        selectedSnapshotEntityMetadata, selectedEntityType: value,
                        entitySelectionModel: this.resetSelectionModel(value, undefined, undefined, true)
                      })
                    } else {
                      this.setState(_.set(['modifiedConfig', 'rootEntityType'], value))
                      this.setState(_.unset(['modifiedConfig', 'dataReferenceName']))
                      this.setState({
                        selectedEntityType: value, entitySelectionModel: this.resetSelectionModel(value, {}, entityMetadata, false),
                        selectedSnapshotEntityMetadata: undefined
                      })
                    }
                  },
                  options: [
                    {
                      label: 'TABLES',
                      options: _.map(
                        entityType => ({ value: entityType, source: 'table' }),
                        _.sortBy(_.lowerCase, [...entityTypes, ...possibleSetTypes])
                      )
                    },
                    {
                      label: 'SNAPSHOTS',
                      options: _.map(({ name }) => ({ value: name, source: 'snapshot' }), availableSnapshots)
                    }
                  ]
                })
              ]),
              entitySelectionModel.type === processSnapshotTable ? div({ style: { margin: '2rem 0 0 2rem' } }, [
                h(Select, {
                  isDisabled: !!Utils.editWorkspaceError(ws),
                  'aria-label': 'Snapshot table selector',
                  isClearable: false,
                  value: modifiedConfig.dataReferenceName ? modifiedConfig.rootEntityType : undefined,
                  onChange: ({ value }) => {
                    this.setState(_.set(['modifiedConfig', 'rootEntityType'], value))
                    this.setState(_.unset(['modifiedConfig', 'entityName']))
                  },
                  styles: { container: old => ({ ...old, display: 'inline-block', width: 200, marginLeft: '0.5rem' }) },
                  options: _.sortBy(_.identity, _.keys(selectedSnapshotEntityMetadata))
                })
              ]) :
                div({ style: { marginLeft: '2rem', paddingLeft: '2rem', borderLeft: `2px solid ${colors.dark(0.2)}`, flex: 1 } }, [
                  div({ style: { height: '2rem', fontWeight: 'bold' } }, ['Step 2']),
                  div({ style: { display: 'flex', alignItems: 'center' } }, [
                    h(ButtonPrimary, {
                      disabled: currentSnapRedacted || this.isSingle() || !rootEntityType ||
                        !_.includes(selectedEntityType, [...entityTypes, ...possibleSetTypes]) || !!Utils.editWorkspaceError(ws),
                      tooltip: Utils.editWorkspaceError(ws),
                      onClick: () => this.setState({ selectingData: true })
                    }, ['Select Data']),
                    label({ style: { marginLeft: '1rem' } }, [`${this.describeSelectionModel()}`])
                  ])
                ])
            ])
          ]),
          div({ style: { display: 'flex', alignItems: 'baseline', minWidth: 'max-content' } }, [
            // This span is to prevent vertical resizing when the memory retry multiplier input is visible.
            span({ style: { marginTop: '0.5rem', marginBottom: '0.5rem' } }, [
              span([
                h(LabeledCheckbox, {
                  disabled: currentSnapRedacted || !!Utils.computeWorkspaceError(ws),
                  checked: useCallCache,
                  onChange: v => this.setState({ useCallCache: v })
                }, [' Use call caching'])
              ]),
              span({ style: styles.checkBoxSpanMargins }, [
                h(LabeledCheckbox, {
                  checked: deleteIntermediateOutputFiles,
                  onChange: v => this.setState({ deleteIntermediateOutputFiles: v }),
                  style: styles.checkBoxLeftMargin
                }, [' Delete intermediate outputs'])
              ]),
              h(InfoBox, [
                'If the workflow succeeds, only the final output will be saved. Subsequently, call caching cannot be used as the intermediate steps will be not available. ',
                h(Link, { href: this.getSupportLink('360039681632'), ...Utils.newTabLinkProps },
                  [clickToLearnMore])
              ]),
              span({ style: styles.checkBoxSpanMargins }, [
                h(LabeledCheckbox, {
                  checked: useReferenceDisks,
                  onChange: v => this.setState({ useReferenceDisks: v }),
                  style: styles.checkBoxLeftMargin
                }, [' Use reference disks'])
              ]),
              h(InfoBox, [
                'Use a reference disk image if available rather than localizing reference inputs. ',
                h(Link, { href: this.getSupportLink('360056384631'), ...Utils.newTabLinkProps },
                  [clickToLearnMore])
              ]),
              span({ style: styles.checkBoxSpanMargins }, [
                h(LabeledCheckbox, {
                  checked: retryWithMoreMemory,
                  onChange: v => this.setState({ retryWithMoreMemory: v }),
                  style: styles.checkBoxLeftMargin
                }, [' Retry with more memory'])
              ])
            ]),
            retryWithMoreMemory && span({ style: { margin: '0 0.5rem 0 0.5rem' } }, [
              h(IdContainer, [
                id => h(Fragment, [
                  label({
                    htmlFor: id,
                    style: { ...styles.label, verticalAlign: 'middle' }
                  }, ['Memory retry factor:']),
                  div({ style: { display: 'inline-block', marginLeft: '0.25rem' } }, [
                    h(NumberInput, {
                      id,
                      min: 1.1,
                      max: 10,
                      step: 0.1,
                      isClearable: false,
                      onlyInteger: false,
                      value: retryMemoryFactor,
                      style: { width: '5rem' },
                      onChange: v => this.setState({ retryMemoryFactor: v })
                    })
                  ])
                ])
              ])
            ]),
            // We show either an info message or a warning, based on whether increasing memory on retries is
            // enabled and the value of the retry multiplier.
            (retryWithMoreMemory && retryMemoryFactor > 2 ?
              h(InfoBox,
                { style: { color: colors.warning() }, iconOverride: 'warning-standard' }, [
                  'Retry factors above 2 are not recommended. The retry factor compounds and may substantially increase costs. ',
                  h(Link, { href: this.getSupportLink('4403215299355'), ...Utils.newTabLinkProps },
                    [clickToLearnMore])
                ]) :
              h(InfoBox, [
                'If a task has a maxRetries value greater than zero and fails because it ran out of memory, retry it with more memory. ',
                h(Link, { href: this.getSupportLink('4403215299355'), ...Utils.newTabLinkProps },
                  [clickToLearnMore])
              ])
            )
          ]),
          h(StepButtons, {
            tabs: [
              ...(!currentSnapRedacted ? [{ key: 'wdl', title: 'Script', isValid: true }] : []),
              { key: 'inputs', title: 'Inputs', isValid: inputsValid },
              { key: 'outputs', title: 'Outputs', isValid: outputsValid }
            ],
            activeTab,
            onChangeTab: v => this.setState({ activeTab: v, filter: '' }),
            finalStep: h(ButtonPrimary, {
              style: { marginLeft: '1rem' },
              disabled: !!Utils.computeWorkspaceError(ws) || !!noLaunchReason || currentSnapRedacted,
              tooltip: Utils.computeWorkspaceError(ws) || noLaunchReason || (currentSnapRedacted && 'Workflow version was redacted.'),
              onClick: () => this.setState({ launching: true })
            }, ['Run analysis'])
          }),
          activeTab === 'outputs' && !currentSnapRedacted && div({ style: { marginBottom: '1rem' } }, [
            div({ style: styles.outputInfoLabel }, 'Output files will be saved to'),
            div({ style: { display: 'flex', alignItems: 'center' } }, [
              div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [icon('folder', { size: 18 })]),
              div({ style: { flex: 1 } }, [
                'Files / ',
                span({ style: styles.placeholder }, 'submission unique ID'),
                ' / ', wdl ? wdl.match(/^\s*workflow ([^\s{]+)\s*{/m)[1] : span({ style: styles.placeholder }, 'workflow name'), ' / ',
                span({ style: styles.placeholder }, 'workflow unique ID')
              ])
            ]),
            !!rootEntityType && (entitySelectionModel.type !== processSnapshotTable) && h(Fragment, [
              div({ style: { margin: '0.5rem 0', borderBottom: `1px solid ${colors.dark(0.55)}` } }),
              div({ style: styles.outputInfoLabel }, 'References to outputs will be written to'),
              div({ style: { display: 'flex', alignItems: 'center' } }, [
                div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [icon('listAlt')]),
                `Tables / ${rootEntityType}`
              ]),
              `Fill in the attributes below to add or update columns in your data table`
            ])
          ])
        ])
      ]),
      div({ style: styles.messageContainer }, [
        saving && miniMessage('Saving...'),
        saved && !saving && !modified && miniMessage('Saved!'),
        modified && h(ButtonPrimary, { disabled: saving || !this.canSave(), onClick: () => this.save() }, 'Save'),
        modified && h(ButtonSecondary, { style: { marginLeft: '1rem' }, disabled: saving, onClick: () => this.cancel() }, 'Cancel')
      ]),
      exporting && h(ExportWorkflowModal, {
        thisWorkspace: workspace, methodConfig: savedConfig,
        onDismiss: () => this.setState({ exporting: false })
      }),
      copying && h(ExportWorkflowModal, {
        thisWorkspace: workspace, methodConfig: savedConfig,
        sameWorkspace: true,
        onDismiss: () => this.setState({ copying: false }),
        onSuccess: () => Nav.goToPath('workspace-workflows', { namespace, name: workspaceName })
      }),
      deleting && h(DeleteWorkflowModal, {
        workspace, methodConfig: savedConfig,
        onDismiss: () => this.setState({ deleting: false }),
        onSuccess: () => Nav.goToPath('workspace-workflows', _.pick(['namespace', 'name'], workspace))
      }),
      selectingData && h(DataStepContent, {
        entityMetadata,
        entitySelectionModel,
        onDismiss: () => {
          this.setState({ selectingData: false })
        },
        onSuccess: model => this.setState({ entitySelectionModel: model, selectingData: false }),
        workspace,
        rootEntityType: modifiedConfig.rootEntityType,
        workspaceId: { namespace, name: workspaceName }
      })
    ])
  }

  downloadJson(key) {
    const { modifiedConfig } = this.state
    const prepIO = _.mapValues(v => /^".*"/.test(v) ? v.slice(1, -1) : `\${${v}}`)

    const blob = new Blob([JSON.stringify(prepIO(modifiedConfig[key]))], { type: 'application/json' })
    FileSaver.saveAs(blob, `${key}.json`)
  }

  async uploadJson(key, file) {
    try {
      const rawUpdates = JSON.parse(await Utils.readFileAsText(file))
      const updates = _.mapValues(v => _.isString(v) && v.match(/\${(.*)}/) ?
        v.replace(/\${(.*)}/, (_, match) => match) :
        JSON.stringify(v)
      )(rawUpdates)
      this.setState(({ modifiedConfig, modifiedInputsOutputs }) => {
        const existing = _.map('name', modifiedInputsOutputs[key])
        return {
          modifiedConfig: _.update(key, _.assign(_, _.pick(existing, updates)), modifiedConfig)
        }
      })
    } catch (error) {
      if (error instanceof SyntaxError) {
        reportError('Error processing file', 'This json file is not formatted correctly.')
      } else {
        reportError('Error processing file', error)
      }
    }
  }

  renderWDL() {
    const { wdl } = this.state
    return div({ style: styles.tabContents }, [
      wdl ? h(WDLViewer, {
        wdl, readOnly: true,
        style: { maxHeight: 500 }
      }) : centeredSpinner()
    ])
  }

  renderIOTable(key) {
    const { workspace } = this.props
    const {
      modifiedConfig, modifiedInputsOutputs, errors, entityMetadata, workspaceAttributes, includeOptionalInputs, currentSnapRedacted, filter,
      selectedSnapshotEntityMetadata
    } = this.state
    // Sometimes we're getting totally empty metadata. Not sure if that's valid; if not, revert this

    const selectedTableName = modifiedConfig.dataReferenceName ? modifiedConfig.rootEntityType : undefined
    const selectionMetadata = selectedTableName ? selectedSnapshotEntityMetadata : entityMetadata
    const attributeNames = _.get([modifiedConfig.rootEntityType, 'attributeNames'], selectionMetadata) || []
    const suggestions = [
      ...(!selectedTableName && !modifiedConfig.dataReferenceName) ? [`this.${modifiedConfig.rootEntityType}_id`] : [],
      ...(modifiedConfig.rootEntityType ? _.map(name => `this.${name}`, attributeNames) : []),
      ..._.map(name => `workspace.${name}`, workspaceAttributes)
    ]
    const data = currentSnapRedacted ?
      _.map(k => ({ name: k, inputType: 'unknown' }), _.keys(modifiedConfig[key])) :
      modifiedInputsOutputs[key]
    const filteredData = _.filter(({ name, optional }) => {
      return !(key === 'inputs' && !includeOptionalInputs && optional) && Utils.textMatch(filter, name)
    }, data)

    const isSingleAndOutputs = key === 'outputs' && this.isSingle()
    const isEditable = !currentSnapRedacted && !Utils.editWorkspaceError(workspace) && !isSingleAndOutputs

    const linkStyle = { color: colors.accent(1.05) } // Get to 4.5:1 contrast on the gray background

    return h(Dropzone, {
      key,
      accept: '.json',
      multiple: false,
      disabled: currentSnapRedacted || !!Utils.editWorkspaceError(workspace) || data.length === 0,
      style: {
        ...styles.tabContents,
        flex: 'auto', display: 'flex', flexDirection: 'column',
        position: undefined
      },
      activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
      onDropRejected: () => reportError('Not a valid inputs file',
        'The selected file is not a json file. To import inputs for this workflow, upload a file with a .json extension.'),
      onDropAccepted: files => this.uploadJson(key, files[0])
    }, [({ openUploader }) => data.length === 0 ? `No configurable ${key}.` : h(Fragment, [
      div({ style: { flex: 'none', display: 'flex', alignItems: 'center', marginBottom: '0.25rem' } }, [
        isSingleAndOutputs && !currentSnapRedacted && div({ style: { margin: '0 1rem 0.5rem' } }, [
          b(['Outputs are not mapped to the data model when processing a single workflow from files.']),
          div(['To write to the data model, select "Process multiple workflows" above.'])
        ]),
        key === 'inputs' && _.some('optional', modifiedInputsOutputs['inputs']) ?
          h(Link, { style: { marginRight: 'auto', ...linkStyle }, onClick: () => this.setState({ includeOptionalInputs: !includeOptionalInputs }) },
            [includeOptionalInputs ? 'Hide optional inputs' : 'Show optional inputs']) :
          div({ style: { marginRight: 'auto' } }),
        h(Link, { style: linkStyle, onClick: () => this.downloadJson(key) }, ['Download json']),
        isEditable && h(Fragment, [
          div({ style: { whiteSpace: 'pre' } }, ['  |  Drag or click to ']),
          h(Link, { style: linkStyle, onClick: openUploader }, ['upload json'])
        ]),
        h(DelayedSearchInput, {
          'aria-label': `Search ${key}`,
          style: { marginLeft: '1rem', width: 200 },
          placeholder: `SEARCH ${key.toUpperCase()}`,
          value: filter,
          onChange: filter => this.setState({ filter })
        })
      ]),
      div({ style: { flex: '1 0 auto' } }, [
        h(WorkflowIOTable, {
          readOnly: !isEditable,
          which: key,
          inputsOutputs: filteredData,
          config: modifiedConfig,
          errors,
          onBrowse: name => this.setState({ variableSelected: name }),
          onChange: (name, v) => this.setState(_.set(['modifiedConfig', key, name], v)),
          onSetDefaults: () => this.setState(oldState => {
            return _.set(
              ['modifiedConfig', 'outputs'],
              _.fromPairs(_.map(({ name }) => [name, `this.${_.last(name.split('.'))}`], oldState.modifiedInputsOutputs.outputs)),
              oldState
            )
          }),
          suggestions
        })
      ])
    ])])
  }

  async save() {
    const { namespace, name, workflowNamespace, workflowName } = this.props
    const { modifiedConfig, modifiedInputsOutputs, entitySelectionModel: { type } } = this.state

    this.setState({ saving: true })

    try {
      const trimInputOutput = _.flow(
        _.update('inputs', _.mapValues(_.trim)),
        _.update('outputs', this.isSingle() ? () => ({}) : _.mapValues(_.trim))
      )

      const validationResponse = await Ajax().Workspaces.workspace(namespace, name)
        .methodConfig(workflowNamespace, workflowName)
        .save(trimInputOutput(modifiedConfig))

      this.setState({
        saved: true,
        savedConfig: validationResponse.methodConfiguration,
        modifiedConfig: validationResponse.methodConfiguration,
        errors: augmentErrors(validationResponse),
        savedInputsOutputs: modifiedInputsOutputs,
        ...(type === processSnapshotTable ?
          {
            selectedEntityType: validationResponse.methodConfiguration.dataReferenceName,
            selectedTableName: validationResponse.methodConfiguration.rootEntityType
          } :
          { selectedEntityType: validationResponse.methodConfiguration.rootEntityType, selectedTableName: undefined }
        )
      }, () => setTimeout(() => this.setState({ saved: false }), 3000))
    } catch (error) {
      reportError('Error saving', error)
    } finally {
      this.setState({ saving: false })
    }
  }

  cancel() {
    const { savedConfig, savedInputsOutputs, savedConfig: { rootEntityType }, savedSnapRedacted, activeTab } = this.state

    this.setState({
      saved: false, modifiedConfig: savedConfig, modifiedInputsOutputs: savedInputsOutputs,
      entitySelectionModel: this.resetSelectionModel(rootEntityType), currentSnapRedacted: savedSnapRedacted,
      activeTab: activeTab === 'wdl' && savedSnapRedacted ? 'inputs' : activeTab
    })
    this.updateSingleOrMultipleRadioState(savedConfig)
  }
})


export const navPaths = [
  {
    name: 'workflow',
    path: '/workspaces/:namespace/:name/workflows/:workflowNamespace/:workflowName',
    component: WorkflowView,
    title: ({ name, workflowName }) => `${name} - Workflows - ${workflowName}`
  }, {
    name: 'tools-workflow', // legacy
    path: '/workspaces/:namespace/:name/tools/:workflowNamespace/:workflowName',
    component: props => h(Nav.Redirector, { pathname: Nav.getPath('workflow', props) })
  }
]
