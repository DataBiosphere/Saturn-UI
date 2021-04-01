import filesize from 'filesize'
import _ from 'lodash/fp'
import { Fragment, useEffect, useImperativeHandle, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import Collapse from 'src/components/Collapse'
import { Clickable, Link, spinnerOverlay } from 'src/components/common'
import { EntityUploader, ReferenceDataDeleter, ReferenceDataImporter, renderDataCell, saveScroll } from 'src/components/data/data-utils'
import EntitiesContent from 'src/components/data/EntitiesContent'
import LocalVariablesContent from 'src/components/data/LocalVariablesContent'
import Dropzone from 'src/components/Dropzone'
import FloatingActionButton from 'src/components/FloatingActionButton'
import { icon, spinner } from 'src/components/icons'
import { DelayedSearchInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { FlexTable, HeaderCell, SimpleTable, TextCell } from 'src/components/table'
import UriViewer from 'src/components/UriViewer'
import { SnapshotInfo } from 'src/components/workspace-utils'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import { pfbImportJobStore } from 'src/libs/state'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const localVariables = 'localVariables'
const bucketObjects = '__bucket_objects__'

const styles = {
  tableContainer: {
    display: 'flex', flex: 1
  },
  dataTypeSelectionPanel: {
    flex: 'none', width: 280, backgroundColor: 'white',
    boxShadow: '0 2px 5px 0 rgba(0,0,0,0.25)'
  },
  tableViewPanel: {
    position: 'relative',
    overflow: 'hidden',
    padding: '1rem', width: '100%',
    flex: 1, display: 'flex', flexDirection: 'column'
  }
}

const DataTypeButton = ({ selected, children, iconName = 'listAlt', iconSize = 14, buttonStyle, ...props }) => {
  return h(Clickable, {
    style: { ...Style.navList.item(selected), color: colors.accent(1.2), ...buttonStyle },
    hover: Style.navList.itemHover(selected),
    ...props
  }, [
    div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [
      icon(iconName, { size: iconSize })
    ]),
    div({ style: { flex: 1, ...Style.noWrapEllipsis }, title: children }, [
      children
    ])
  ])
}

const DataImportPlaceholder = () => {
  return div({ style: { ...Style.navList.item(false), color: colors.dark(0.7) } }, [
    div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [
      icon('downloadRegular', { size: 14 })
    ]),
    div({ style: { flex: 1 } }, ['Data import in progress'])
  ])
}

const getReferenceData = _.flow(
  _.toPairs,
  _.filter(([key]) => key.startsWith('referenceData_')),
  _.map(([k, value]) => {
    const [, datum, key] = /referenceData_([^_]+)_(.+)/.exec(k)
    return { datum, key, value }
  }),
  _.groupBy('datum')
)

const ReferenceDataContent = ({ workspace: { workspace: { namespace, attributes } }, referenceKey, firstRender }) => {
  const [textFilter, setTextFilter] = useState('')

  const selectedData = _.flow(
    _.filter(({ key, value }) => Utils.textMatch(textFilter, `${key} ${value}`)),
    _.sortBy('key')
  )(getReferenceData(attributes)[referenceKey])
  const { initialY } = firstRender ? StateHistory.get() : {}

  return h(Fragment, [
    h(DelayedSearchInput, {
      'aria-label': 'Search',
      style: { width: 300, marginBottom: '1rem', alignSelf: 'flex-end' },
      placeholder: 'Search',
      onChange: setTextFilter,
      value: textFilter
    }),
    div({ style: { flex: 1 } }, [
      h(AutoSizer, [
        ({ width, height }) => h(FlexTable, {
          width, height, rowCount: selectedData.length,
          onScroll: y => saveScroll(0, y),
          initialY,
          noContentMessage: 'No matching data',
          columns: [
            {
              size: { basis: 400, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Key']),
              cellRenderer: ({ rowIndex }) => renderDataCell(selectedData[rowIndex].key, namespace)
            },
            {
              size: { grow: 1 },
              headerRenderer: () => h(HeaderCell, ['Value']),
              cellRenderer: ({ rowIndex }) => renderDataCell(selectedData[rowIndex].value, namespace)
            }
          ]
        })
      ])
    ])
  ])
}
const SnapshotContent = ({ workspace, snapshotDetails, loadMetadata, onUpdate, onDelete, firstRender, snapshotKey: [snapshotName, tableName] }) => {
  return Utils.cond(
    [!snapshotDetails?.[snapshotName], () => spinnerOverlay],
    [!!tableName, () => h(EntitiesContent, {
      snapshotName,
      workspace,
      entityMetadata: snapshotDetails[snapshotName].entityMetadata,
      entityKey: tableName,
      loadMetadata,
      firstRender
    })],
    () => h(SnapshotInfo, { workspace, resource: snapshotDetails[snapshotName].resource, snapshotName, onUpdate, onDelete })
  )
}

export const DeleteObjectModal = ({ name, workspace: { workspace: { namespace, bucketName } }, onSuccess, onDismiss }) => {
  const [deleting, setDeleting] = useState(false)

  const doDelete = _.flow(
    withErrorReporting('Error deleting object'),
    Utils.withBusyState(setDeleting)
  )(async () => {
    await Ajax().Buckets.delete(namespace, bucketName, name)
    onSuccess()
  })

  return h(Modal, {
    onDismiss,
    okButton: doDelete,
    title: 'Delete this file?',
    danger: true
  }, [
    'Are you sure you want to delete this file from the Google bucket?',
    deleting && spinnerOverlay
  ])
}

const BucketContent = _.flow(
  Utils.withDisplayName('BucketContent'),
  requesterPaysWrapper({ onDismiss: ({ onClose }) => onClose() })
)(({
  workspace, workspace: { workspace: { namespace, bucketName } }, firstRender, refreshKey,
  onRequesterPaysError
}) => {
  // State
  const [prefix, setPrefix] = useState(() => firstRender ? (StateHistory.get().prefix || '') : '')
  const [prefixes, setPrefixes] = useState(undefined)
  const [objects, setObjects] = useState(() => firstRender ? StateHistory.get().objects : undefined)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingName, setDeletingName] = useState(undefined)
  const [viewingName, setViewingName] = useState(undefined)

  const signal = Utils.useCancellation()


  // Helpers
  const load = _.flow(
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error loading bucket data'),
    Utils.withBusyState(setLoading)
  )(async (targetPrefix = prefix) => {
    const { items, prefixes } = await Ajax(signal).Buckets.list(namespace, bucketName, targetPrefix)
    setPrefix(targetPrefix)
    setPrefixes(prefixes)
    setObjects(items)
  })

  const uploadFiles = _.flow(
    withErrorReporting('Error uploading file'),
    Utils.withBusyState(setUploading)
  )(async ([file]) => {
    await Ajax().Buckets.upload(namespace, bucketName, prefix, file)
    load()
  })


  // Lifecycle
  useEffect(() => {
    load(firstRender ? undefined : '')
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    StateHistory.update({ objects, prefix })
  }, [objects, prefix])


  // Render
  const prefixParts = _.dropRight(1, prefix.split('/'))
  const makeBucketLink = ({ label, target, onClick }) => h(Link, {
    style: { textDecoration: 'underline' },
    href: target,
    onClick: e => {
      e.preventDefault()
      onClick()
    }
  }, [label])

  return h(Dropzone, {
    disabled: !!Utils.editWorkspaceError(workspace),
    style: { flexGrow: 1, backgroundColor: 'white', border: `1px solid ${colors.dark(0.55)}`, padding: '1rem' },
    activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
    onDropAccepted: uploadFiles
  }, [({ openUploader }) => h(Fragment, [
    div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
      div([
        _.map(({ label, target }) => {
          return h(Fragment, { key: target }, [
            makeBucketLink({ label, target, onClick: () => load(target) }),
            ' / '
          ])
        }, [
          { label: 'Files', target: '' },
          ..._.map(n => {
            return { label: prefixParts[n], target: _.map(s => `${s}/`, _.take(n + 1, prefixParts)).join('') }
          }, _.range(0, prefixParts.length))
        ])
      ]),
      h(Link, { href: `https://seqr.broadinstitute.org/workspace/${namespace}/${workspace.workspace.name}` },
        ['Analyze in Seqr ', icon('pop-out', { size: 14 })]
      )
    ]),
    div({ style: { margin: '1rem -1rem 1rem -1rem', borderBottom: `1px solid ${colors.dark(0.25)}` } }),
    h(SimpleTable, {
      columns: [
        { size: { basis: 24, grow: 0 }, key: 'button' },
        { header: h(HeaderCell, ['Name']), size: { grow: 1 }, key: 'name' },
        { header: h(HeaderCell, ['Size']), size: { basis: 200, grow: 0 }, key: 'size' },
        { header: h(HeaderCell, ['Last modified']), size: { basis: 200, grow: 0 }, key: 'updated' }
      ],
      rows: [
        ..._.map(p => {
          return {
            name: h(TextCell, [
              makeBucketLink({
                label: p.slice(prefix.length),
                target: `gs://${bucketName}/${p}`,
                onClick: () => load(p)
              })
            ])
          }
        }, prefixes),
        ..._.map(({ name, size, updated }) => {
          return {
            button: h(Link, {
              style: { display: 'flex' }, onClick: () => setDeletingName(name),
              tooltip: 'Delete file'
            }, [
              icon('trash', { size: 16, className: 'hover-only' })
            ]),
            name: h(TextCell, [
              makeBucketLink({
                label: name.slice(prefix.length),
                target: `gs://${bucketName}/${name}`,
                onClick: () => setViewingName(name)
              })
            ]),
            size: filesize(size, { round: 0 }),
            updated: Utils.makePrettyDate(updated)
          }
        }, objects)
      ]
    }),
    deletingName && h(DeleteObjectModal, {
      workspace, name: deletingName,
      onDismiss: () => setDeletingName(),
      onSuccess: () => {
        setDeletingName()
        load()
      }
    }),
    viewingName && h(UriViewer, {
      googleProject: namespace, uri: `gs://${bucketName}/${viewingName}`,
      onDismiss: () => setViewingName(undefined)
    }),
    !Utils.editWorkspaceError(workspace) && h(FloatingActionButton, {
      label: 'UPLOAD',
      iconShape: 'plus',
      onClick: openUploader
    }),
    (loading || uploading) && spinnerOverlay
  ])])
})

const DataTypeSection = ({ title, titleExtras, error, retryFunction, children }) => h(Fragment, [
  div({ style: Style.navList.heading }, [
    title,
    error ? h(Link, {
      onClick: retryFunction,
      tooltip: 'Error loading, click to retry.'
    }, [icon('sync', { size: 18 })]) : titleExtras
  ]),
  children
])

const WorkspaceData = _.flow(
  Utils.forwardRefWithName('WorkspaceData'),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Data', activeTab: 'data'
  })
)(({ namespace, name, workspace, workspace: { workspace: { attributes } }, refreshWorkspace }, ref) => {
  // State
  const [firstRender, setFirstRender] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const forceRefresh = () => setRefreshKey(_.add(1))
  const [selectedDataType, setSelectedDataType] = useState(() => StateHistory.get().selectedDataType)
  const [entityMetadata, setEntityMetadata] = useState(() => StateHistory.get().entityMetadata)
  const [snapshotDetails, setSnapshotDetails] = useState(() => StateHistory.get().snapshotDetails)
  const [importingReference, setImportingReference] = useState(false)
  const [deletingReference, setDeletingReference] = useState(undefined)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [entityMetadataError, setEntityMetadataError] = useState()
  const [snapshotMetadataError, setSnapshotMetadataError] = useState()

  const signal = Utils.useCancellation()
  const pfbImportJobs = Utils.useStore(pfbImportJobStore)


  // Helpers
  const getSelectionType = () => {
    const referenceData = getReferenceData(attributes)
    return Utils.cond(
      [!selectedDataType, () => 'none'],
      [selectedDataType === localVariables, () => 'localVariables'],
      [selectedDataType === bucketObjects, () => 'bucketObjects'],
      [_.isArray(selectedDataType), () => 'snapshots'],
      [_.includes(selectedDataType, _.keys(referenceData)), () => 'referenceData'],
      () => 'entities'
    )
  }

  const loadEntityMetadata = async () => {
    try {
      setEntityMetadataError(false)
      const entityMetadata = await Ajax(signal).Workspaces.workspace(namespace, name).entityMetadata()

      setSelectedDataType(getSelectionType() === 'entities' && !entityMetadata[selectedDataType] ? undefined : selectedDataType)
      setEntityMetadata(entityMetadata)
    } catch (error) {
      reportError('Error loading workspace entity data', error)
      setEntityMetadataError(true)
      setSelectedDataType(undefined)
      setEntityMetadata({})
    }
  }

  const loadSnapshotMetadata = async () => {
    try {
      setSnapshotMetadataError(false)
      const { resources: snapshotMetadata } = await Ajax(signal).Workspaces.workspace(namespace, name).listSnapshots(1000, 0)

      const snapshots = _.reduce((acc, { name, ...resource }) => {
        return _.set([name, 'resource'], resource, acc)
      },
      _.pick(_.map('name', snapshotMetadata), snapshotDetails) || {}, // retain entities if loaded from state history, but only for snapshots that exist
      snapshotMetadata)

      setSnapshotDetails(snapshots)
    } catch (error) {
      reportError('Error loading workspace snapshot data', error)
      setSnapshotMetadataError(true)
      setSelectedDataType(undefined)
      setSnapshotDetails({})
    }
  }

  const loadMetadata = () => Promise.all([loadEntityMetadata(), loadSnapshotMetadata()])

  const loadSnapshotEntities = async snapshotName => {
    try {
      setSnapshotDetails(_.set([snapshotName, 'error'], false))
      const entities = await Ajax(signal).Workspaces.workspace(namespace, name).snapshotEntityMetadata(namespace, snapshotName)
      setSnapshotDetails(_.set([snapshotName, 'entityMetadata'], entities))
    } catch (error) {
      reportError(`Error loading entities in snapshot ${snapshotName}`, error)
      setSnapshotDetails(_.set([snapshotName, 'error'], true))
    }
  }

  const toSortedPairs = _.flow(_.toPairs, _.sortBy(_.first))


  // Lifecycle
  Utils.useOnMount(() => {
    loadMetadata()
    setFirstRender(false)
  })

  useEffect(() => {
    StateHistory.update({ entityMetadata, selectedDataType, snapshotDetails })
  }, [entityMetadata, selectedDataType, snapshotDetails])

  useImperativeHandle(ref, () => ({
    refresh: () => {
      forceRefresh()
      loadMetadata()
    }
  }))


  // Render
  const referenceData = getReferenceData(attributes)
  const sortedEntityPairs = toSortedPairs(entityMetadata)
  const sortedSnapshotPairs = toSortedPairs(snapshotDetails)

  return div({ style: styles.tableContainer }, [
    !entityMetadata ? spinnerOverlay : h(Fragment, [
      div({ style: styles.dataTypeSelectionPanel }, [
        h(DataTypeSection, {
          title: 'Tables',
          titleExtras: h(Link, {
            'aria-label': 'Upload .tsv',
            disabled: !!Utils.editWorkspaceError(workspace),
            tooltip: Utils.editWorkspaceError(workspace) || 'Upload .tsv',
            onClick: () => setUploadingFile(true)
          }, [icon('plus-circle', { size: 21 })]),
          error: entityMetadataError,
          retryFunction: loadEntityMetadata
        }, [
          _.some({ targetWorkspace: { namespace, name } }, pfbImportJobs) && h(DataImportPlaceholder),
          _.map(([type, typeDetails]) => {
            return h(DataTypeButton, {
              key: type,
              selected: selectedDataType === type,
              onClick: () => {
                setSelectedDataType(type)
                forceRefresh()
              }
            }, [`${type} (${typeDetails.count})`])
          }, sortedEntityPairs)
        ]),
        (!_.isEmpty(sortedSnapshotPairs) || snapshotMetadataError) && h(DataTypeSection, {
          title: 'Snapshots',
          error: snapshotMetadataError,
          retryFunction: loadSnapshotMetadata
        }, [
          _.map(([snapshotName, { resource: { referenceId, reference: { snapshot } }, entityMetadata: snapshotTables, error: snapshotTablesError }]) => {
            const snapshotTablePairs = toSortedPairs(snapshotTables)
            return h(Collapse, {
              key: snapshotName,
              titleFirst: true,
              buttonStyle: { height: 50, color: colors.dark(), fontWeight: 600, marginBottom: 0, overflow: 'hidden' },
              style: { fontSize: 14, paddingLeft: '1.5rem', borderBottom: `1px solid ${colors.dark(0.2)}` },
              title: snapshotName, noTitleWrap: true,
              afterToggle: h(Link, {
                style: { marginRight: '0.5rem' },
                tooltip: 'Snapshot Info',
                onClick: () => {
                  setSelectedDataType([snapshotName])
                  forceRefresh()
                }
              }, [icon(`info-circle${_.isEqual(selectedDataType, [snapshotName]) ? '' : '-regular'}`, { size: 20 })]),
              initialOpenState: _.head(selectedDataType) === snapshotName,
              onFirstOpen: () => loadSnapshotEntities(snapshotName)
            }, [Utils.cond(
              [snapshotTablesError, () => div({
                style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }
              }, [
                'Failed to load tables',
                h(Link, {
                  onClick: () => loadSnapshotEntities(snapshotName),
                  tooltip: 'Error loading, click to retry.'
                }, [icon('sync', { size: 24, style: { marginLeft: '1rem' } })])
              ])],
              [snapshotTables === undefined, () => div({
                style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }
              }, [
                'Loading snapshot contents...',
                spinner({ style: { marginLeft: '1rem' } })
              ])],
              () => div({ style: { fontSize: 14, lineHeight: '1.5' } }, [
                _.map(([tableName, { count }]) => {
                  return h(DataTypeButton, {
                    buttonStyle: { borderBottom: 0, height: 40 },
                    key: `${snapshotName}_${tableName}`,
                    selected: _.isEqual(selectedDataType, [snapshotName, tableName]),
                    onClick: () => {
                      setSelectedDataType([snapshotName, tableName])
                      Ajax().Metrics.captureEvent(Events.workspaceSnapshotContentsView, {
                        ...extractWorkspaceDetails(workspace.workspace),
                        referenceId,
                        snapshotId: snapshot,
                        entityType: tableName
                      })
                      forceRefresh()
                    }
                  }, [`${tableName} (${count})`])
                }, snapshotTablePairs)
              ])
            )])
          }, sortedSnapshotPairs)
        ]),
        div({ style: Style.navList.heading }, [
          div(['Reference Data']),
          h(Link, {
            'aria-label': 'Add reference data',
            disabled: !!Utils.editWorkspaceError(workspace),
            tooltip: Utils.editWorkspaceError(workspace) || 'Add reference data',
            onClick: () => setImportingReference(true)
          }, [icon('plus-circle', { size: 21 })])
        ]),
        importingReference && h(ReferenceDataImporter, {
          onDismiss: () => setImportingReference(false),
          onSuccess: () => {
            setImportingReference(false)
            refreshWorkspace()
          },
          namespace, name
        }),
        deletingReference && h(ReferenceDataDeleter, {
          onDismiss: () => setDeletingReference(false),
          onSuccess: () => {
            setDeletingReference(false)
            setSelectedDataType(selectedDataType === deletingReference ? undefined : selectedDataType)
            refreshWorkspace()
          },
          namespace, name, referenceDataType: deletingReference
        }),
        uploadingFile && h(EntityUploader, {
          onDismiss: () => setUploadingFile(false),
          onSuccess: () => {
            setUploadingFile(false)
            forceRefresh()
            loadMetadata()
          },
          namespace, name,
          entityTypes: _.keys(entityMetadata)
        }),
        _.map(type => {
          return h(DataTypeButton, {
            key: type,
            selected: selectedDataType === type,
            onClick: () => {
              setSelectedDataType(type)
              refreshWorkspace()
            }
          }, [
            div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
              type,
              h(Link, {
                'aria-label': `Delete ${type}`,
                disabled: !!Utils.editWorkspaceError(workspace),
                tooltip: Utils.editWorkspaceError(workspace) || `Delete ${type}`,
                onClick: e => {
                  e.stopPropagation()
                  setDeletingReference(type)
                }
              }, [icon('minus-circle', { size: 16 })])
            ])
          ])
        }, _.keys(referenceData)),
        div({ style: Style.navList.heading }, 'Other Data'),
        h(DataTypeButton, {
          selected: selectedDataType === localVariables,
          onClick: () => {
            setSelectedDataType(localVariables)
            forceRefresh()
          }
        }, ['Workspace Data']),
        h(DataTypeButton, {
          iconName: 'folder', iconSize: 18,
          selected: selectedDataType === bucketObjects,
          onClick: () => {
            setSelectedDataType(bucketObjects)
            forceRefresh()
          }
        }, ['Files'])
      ]),
      div({ style: styles.tableViewPanel }, [
        Utils.switchCase(getSelectionType(),
          ['none', () => div({ style: { textAlign: 'center' } }, ['Select a data type'])],
          ['localVariables', () => h(LocalVariablesContent, {
            workspace,
            refreshKey,
            firstRender
          })],
          ['referenceData', () => h(ReferenceDataContent, {
            key: selectedDataType,
            workspace,
            referenceKey: selectedDataType,
            firstRender
          })],
          ['bucketObjects', () => h(BucketContent, {
            workspace, onClose: () => setSelectedDataType(undefined),
            firstRender, refreshKey
          })],
          ['snapshots', () => h(SnapshotContent, {
            key: refreshKey,
            workspace,
            snapshotDetails,
            snapshotKey: selectedDataType,
            loadMetadata: () => loadSnapshotEntities(selectedDataType[0]),
            onUpdate: async newSnapshotName => {
              await loadSnapshotMetadata()
              setSelectedDataType([newSnapshotName])
              forceRefresh()
            },
            onDelete: async () => {
              await loadSnapshotMetadata()
              setSelectedDataType()
              forceRefresh()
            },
            firstRender
          })],
          ['entities', () => h(EntitiesContent, {
            key: refreshKey,
            workspace,
            entityMetadata,
            entityKey: selectedDataType,
            loadMetadata,
            firstRender
          })]
        )
      ])
    ])
  ])
})

export const navPaths = [
  {
    name: 'workspace-data',
    path: '/workspaces/:namespace/:name/data',
    component: WorkspaceData,
    title: ({ name }) => `${name} - Data`
  }
]
