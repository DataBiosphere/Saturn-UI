import * as clipboard from 'clipboard-polyfill'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { Fragment, useEffect, useRef, useState } from 'react'
import { b, div, h, iframe, p, span } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import { ButtonPrimary, ButtonSecondary, Clickable, LabeledCheckbox, Link, makeMenuIcon, MenuButton, spinnerOverlay } from 'src/components/common'
import { icon, spinner } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { NewClusterModal } from 'src/components/NewClusterModal'
import { findPotentialNotebookLockers, NotebookDuplicator, notebookLockHash } from 'src/components/notebook-utils'
import { notify } from 'src/components/Notifications'
import PopupTrigger from 'src/components/PopupTrigger'
import { dataSyncingDocUrl } from 'src/data/clusters'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorIgnoring, withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { getLocalPref, setLocalPref } from 'src/libs/prefs'
import { authStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import ExportNotebookModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const StatusMessage = ({ hideSpinner, children }) => {
  return div({ style: { padding: '1.5rem 2rem', display: 'flex' } }, [
    !hideSpinner && spinner({ style: { marginRight: '0.5rem' } }),
    div([children])
  ])
}

const ClusterKicker = ({ cluster, refreshClusters, onNullCluster }) => {
  const getCluster = Utils.useGetter(cluster)
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState()

  const startClusterOnce = withErrorReporting('Error starting notebook runtime', async () => {
    while (!signal.aborted) {
      const currentCluster = getCluster()
      const { status, googleProject, clusterName } = currentCluster || {}
      const currentStatus = currentCluster && status
      if (currentStatus === 'Stopped') {
        setBusy(true)
        await Ajax().Jupyter.cluster(googleProject, clusterName).start()
        await refreshClusters()
        setBusy(false)
        return
      } else if (currentStatus === undefined || currentStatus === 'Stopping') {
        await Utils.delay(500)
      } else if (currentStatus === null) {
        onNullCluster()
        return
      } else {
        return
      }
    }
  })

  Utils.useOnMount(() => {
    startClusterOnce()
  })

  return busy ? spinnerOverlay : null
}

const chooseMode = mode => {
  Nav.history.replace({ search: qs.stringify({ mode }) })
}

const ClusterStatusMonitor = ({ cluster, onClusterStoppedRunning }) => {
  const currentStatus = cluster && cluster.status
  const prevStatus = Utils.usePrevious(currentStatus)

  useEffect(() => {
    if (prevStatus === 'Running' && currentStatus !== 'Running') {
      onClusterStoppedRunning()
    }
  }, [currentStatus, onClusterStoppedRunning, prevStatus])

  return null
}

const NotebookLauncher = _.flow(
  Utils.forwardRefWithName('NotebookLauncher'),
  requesterPaysWrapper({
    onDismiss: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name })
  }),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceTab(props, 'notebooks'),
    title: _.get('notebookName'),
    showTabBar: false
  })
)(
  ({ queryParams, notebookName, workspace, workspace: { workspace: { namespace }, accessLevel, canCompute }, cluster, refreshClusters }, ref) => {
    const [createOpen, setCreateOpen] = useState(false)
    // Status note: undefined means still loading, null means no cluster
    const { clusterName, status, labels } = cluster || {}
    const [busy, setBusy] = useState()
    const { mode } = queryParams

    return h(Fragment, [
      (Utils.canWrite(accessLevel) && canCompute && !!mode && status === 'Running') ?
        h(labels.welderInstallFailed ? WelderDisabledNotebookEditorFrame : NotebookEditorFrame, { key: clusterName, workspace, cluster, notebookName, mode }) :
        h(Fragment, [
          h(PreviewHeader, { queryParams, cluster, refreshClusters, notebookName, workspace, readOnlyAccess: !(Utils.canWrite(accessLevel) && canCompute), onCreateCluster: () => setCreateOpen(true) }),
          h(NotebookPreviewFrame, { notebookName, workspace })
        ]),
      mode && h(ClusterKicker, { cluster, refreshClusters, onNullCluster: () => setCreateOpen(true) }),
      mode && h(ClusterStatusMonitor, { cluster, onClusterStoppedRunning: () => chooseMode(undefined) }),
      h(NewClusterModal, {
        isOpen: createOpen,
        namespace, currentCluster: cluster,
        onDismiss: () => {
          chooseMode(undefined)
          setCreateOpen(false)
        },
        onSuccess: withErrorReporting('Error creating cluster', async promise => {
          setCreateOpen(false)
          setBusy(true)
          await promise
          await refreshClusters()
          setBusy(false)
        })
      }),
      busy && spinnerOverlay
    ])
  })

const FileInUseModal = ({ onDismiss, onCopy, onPlayground, namespace, name, bucketName, lockedBy, canShare }) => {
  const [lockedByEmail, setLockedByEmail] = useState()

  Utils.useOnMount(() => {
    const findLockedByEmail = withErrorReporting('Error loading locker information', async () => {
      const potentialLockers = await findPotentialNotebookLockers({ canShare, namespace, wsName: name, bucketName })
      const currentLocker = potentialLockers[lockedBy]
      setLockedByEmail(currentLocker)
    })
    findLockedByEmail()
  })

  return h(Modal, {
    width: 530,
    title: 'Notebook Is In Use',
    onDismiss,
    showButtons: false
  }, [
    p(lockedByEmail ? `This notebook is currently being edited by ${lockedByEmail}.` : `This notebook is currently locked because another user is editing it.`),
    p('You can make a copy, or run it in Playground Mode to explore and execute its contents without saving any changes.'),
    div({ style: { marginTop: '2rem' } }, [
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: () => onDismiss()
      }, ['Cancel']),
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: () => onCopy()
      }, ['Make a copy']),
      h(ButtonPrimary, {
        onClick: () => onPlayground()
      }, ['Run in playground mode'])
    ])
  ])
}

const EditModeDisabledModal = ({ onDismiss, onRecreateCluster, onPlayground }) => {
  return h(Modal, {
    width: 700,
    title: 'Cannot Edit Notebook',
    onDismiss,
    showButtons: false
  }, [
    p('We’ve released important updates that are not compatible with the older runtime associated with this workspace. To enable Edit Mode, please delete your existing runtime and create a new runtime.'),
    p('If you have any files on your old runtime that you want to keep, you can access your old runtime using the Playground Mode option.'),
    h(Link, {
      href: dataSyncingDocUrl,
      ...Utils.newTabLinkProps
    }, ['Read here for more details.']),
    div({ style: { marginTop: '2rem' } }, [
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: () => onDismiss()
      }, ['Cancel']),
      h(ButtonSecondary, {
        style: { padding: '0 1rem', marginLeft: '1rem' },
        onClick: () => onPlayground()
      }, ['Run in playground mode']),
      h(ButtonPrimary, {
        style: { padding: '0 1rem', marginLeft: '2rem' },
        onClick: () => onRecreateCluster()
      }, ['Recreate notebook runtime'])
    ])
  ])
}

const PlaygroundModal = ({ onDismiss, onPlayground }) => {
  const [hidePlaygroundMessage, setHidePlaygroundMessage] = useState(false)
  return h(Modal, {
    width: 530,
    title: 'Playground Mode',
    onDismiss,
    okButton: h(ButtonPrimary, {
      onClick: () => {
        setLocalPref('hidePlaygroundMessage', hidePlaygroundMessage)
        onPlayground()
      }
    },
    'Continue')
  }, [
    p(['Playground mode allows you to explore, change, and run the code, but your edits will not be saved.']),
    p(['To save your work, choose ', span({ style: { fontWeight: 600 } }, ['Download ']), 'from the ', span({ style: { fontWeight: 600 } }, ['File ']), 'menu.']),
    h(LabeledCheckbox, {
      checked: hidePlaygroundMessage,
      onChange: setHidePlaygroundMessage
    }, [span({ style: { marginLeft: '0.5rem' } }, ['Do not show again '])])
  ])
}

const PlaygroundHeader = () => {
  return div({ style: { backgroundColor: colors.warning(0.7), display: 'flex', alignItems: 'center', borderBottom: `2px solid ${colors.dark(0.2)}`, height: '3.5rem', whiteSpace: 'pre' } }, [
    div({ style: { fontSize: 18, fontWeight: 'bold', backgroundColor: colors.warning(0.9), padding: '0 4rem', height: '100%', display: 'flex', alignItems: 'center' } },
      ['PLAYGROUND MODE']),
    div({ style: { marginLeft: '2rem' } }, [
      'Edits to this notebook are ',
      b(['NOT ']),
      'being saved to the workspace. To save your changes, download the notebook using the file menu.',
      h(Link, {
        style: { marginLeft: '0.5rem' },
        href: dataSyncingDocUrl,
        ...Utils.newTabLinkProps
      }, ['Read here for more details.'])
    ])
  ])
}

const PreviewHeader = ({ queryParams, cluster, readOnlyAccess, onCreateCluster, refreshClusters, notebookName, workspace, workspace: { canShare, workspace: { namespace, name, bucketName } } }) => {
  const signal = Utils.useCancellation()
  const { user: { email } } = Utils.useStore(authStore)
  const [fileInUseOpen, setFileInUseOpen] = useState(false)
  const [editModeDisabledOpen, setEditModeDisabledOpen] = useState(false)
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState(null)
  const [exportingNotebook, setExportingNotebook] = useState(false)
  const [copyingNotebook, setCopyingNotebook] = useState(false)
  const clusterStatus = cluster && cluster.status
  const welderEnabled = cluster && !cluster.labels.welderInstallFailed
  const { mode } = queryParams
  const notebookLink = Nav.getLink('workspace-notebook-launch', { namespace, name, notebookName })
  const buttonStyle = { padding: '1rem', backgroundColor: colors.dark(0.1), height: '100%', marginRight: 2 }

  const checkIfLocked = withErrorReporting('Error checking notebook lock status', async () => {
    const { metadata: { lastLockedBy, lockExpiresAt } = {} } = await Ajax(signal).Buckets.notebook(namespace, bucketName, notebookName.slice(0, -6)).getObject()
    const hashedUser = await notebookLockHash(bucketName, email)
    const lockExpirationDate = new Date(parseInt(lockExpiresAt))

    if (lastLockedBy && (lastLockedBy !== hashedUser) && (lockExpirationDate > Date.now())) {
      setLocked(true)
      setLockedBy(lastLockedBy)
    }
  })

  Utils.useOnMount(() => { checkIfLocked() })

  return div({ style: { display: 'flex', alignItems: 'center', borderBottom: `2px solid ${colors.dark(0.2)}`, height: '3.5rem' } }, [
    div({ style: { fontSize: 18, fontWeight: 'bold', backgroundColor: colors.dark(0.2), padding: '0 4rem', height: '100%', display: 'flex', alignItems: 'center' } },
      ['PREVIEW (READ-ONLY)']),
    readOnlyAccess ?
      h(ButtonSecondary, { style: buttonStyle, onClick: () => setExportingNotebook(true) }, [makeMenuIcon('export'), 'Copy to another workspace']) :
      Utils.cond(
        [
          !mode || clusterStatus === null || clusterStatus === 'Stopped', () => h(Fragment, [
            Utils.cond(
              [cluster && !welderEnabled, () => h(ButtonSecondary, {
                style: buttonStyle,
                onClick: () => setEditModeDisabledOpen(true)
              }, [makeMenuIcon('warning-standard'), 'Edit (Disabled)'])],
              [
                locked, () => h(ButtonSecondary, {
                  style: buttonStyle,
                  onClick: () => setFileInUseOpen(true)
                }, [makeMenuIcon('lock'), 'Edit (In use)'])
              ],
              () => h(ButtonSecondary, {
                style: buttonStyle,
                onClick: () => chooseMode('edit')
              }, [makeMenuIcon('edit'), 'Edit'])
            ),
            h(ButtonSecondary, {
              style: buttonStyle,
              onClick: () => getLocalPref('hidePlaygroundMessage') ? chooseMode('playground') : setPlaygroundModalOpen(true)
            }, [makeMenuIcon('chalkboard'), 'Playground mode']),
            h(PopupTrigger, {
              closeOnClick: true,
              content: h(Fragment, [
                h(MenuButton, { onClick: () => setCopyingNotebook(true) }, ['Make a Copy']),
                h(MenuButton, { onClick: () => setExportingNotebook(true) }, ['Copy to another workspace']),
                h(MenuButton, {
                  onClick: withErrorReporting('Error copying to clipboard', async () => {
                    await clipboard.writeText(`${window.location.host}/${notebookLink}`)
                    notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 })
                  })
                }, ['Copy URL to clipboard'])
              ]),
              side: 'bottom'
            }, [
              h(ButtonSecondary, {
                style: buttonStyle
              }, [icon('ellipsis-v')])
            ])
          ])
        ],
        [
          clusterStatus === 'Creating', () => h(StatusMessage, [
            'Creating notebook runtime environment, this will take 5-10 minutes. You can navigate away and return when it’s ready.'
          ])
        ],
        [
          clusterStatus === 'Starting', () => h(StatusMessage, [
            'Starting notebook runtime environment, this may take up to 2 minutes.'
          ])
        ],
        [
          clusterStatus === 'Stopping', () => h(StatusMessage, [
            'Notebook runtime environment is stopping. You can restart it after it finishes.'
          ])
        ],
        [clusterStatus === 'Error', () => h(StatusMessage, { hideSpinner: true }, ['Notebook runtime error.'])]
      ),
    div({ style: { flexGrow: 1 } }),
    div({ style: { position: 'relative' } }, [
      h(Clickable, {
        'aria-label': 'Exit preview mode',
        style: { opacity: 0.65, marginRight: '1.5rem' },
        hover: { opacity: 1 }, focus: 'hover',
        onClick: () => Nav.goToPath('workspace-notebooks', { namespace, name })
      }, [icon('times-circle', { size: 30 })])
    ]),
    editModeDisabledOpen && h(EditModeDisabledModal, {
      onDismiss: () => setEditModeDisabledOpen(false),
      onRecreateCluster: () => {
        setEditModeDisabledOpen(false)
        onCreateCluster()
      },
      onPlayground: () => {
        setEditModeDisabledOpen(false)
        chooseMode('playground')
      }
    }),
    fileInUseOpen && h(FileInUseModal, {
      namespace, name, lockedBy, canShare, bucketName,
      onDismiss: () => setFileInUseOpen(false),
      onCopy: () => {
        setFileInUseOpen(false)
        setCopyingNotebook(true)
      },
      onPlayground: () => {
        setFileInUseOpen(false)
        chooseMode('playground')
      }
    }),
    copyingNotebook && h(NotebookDuplicator, {
      printName: notebookName.slice(0, -6), fromLauncher: true,
      wsName: name, namespace, bucketName, destroyOld: false,
      onDismiss: () => setCopyingNotebook(false),
      onSuccess: () => setCopyingNotebook(false)
    }),
    exportingNotebook && h(ExportNotebookModal, {
      printName: notebookName.slice(0, -6), workspace,
      fromLauncher: true,
      onDismiss: () => setExportingNotebook(false)
    }),
    playgroundModalOpen && h(PlaygroundModal, {
      onDismiss: () => setPlaygroundModalOpen(false),
      onPlayground: () => {
        setPlaygroundModalOpen(false)
        chooseMode('playground')
      }
    })
  ])
}

const NotebookPreviewFrame = ({ notebookName, workspace: { workspace: { namespace, bucketName } }, onRequesterPaysError }) => {
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState()
  const frame = useRef()

  const loadPreview = _.flow(
    Utils.withBusyState(setBusy),
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error previewing notebook')
  )(async () => {
    setPreview(await Ajax(signal).Buckets.notebook(namespace, bucketName, notebookName).preview())
  })
  Utils.useOnMount(() => {
    loadPreview()
  })

  return h(Fragment, [
    preview && h(Fragment, [
      iframe({
        ref: frame,
        onLoad: () => {
          const doc = frame.current.contentWindow.document
          doc.head.appendChild(Utils.createHtmlElement(doc, 'base', Utils.newTabLinkProps))
        },
        style: { border: 'none', flex: 1 },
        srcDoc: preview,
        title: 'Preview for notebook'
      })
    ]),
    busy && div({ style: { margin: '0.5rem 2rem' } }, ['Generating preview...'])
  ])
}

const JupyterFrameManager = ({ onClose, frameRef }) => {
  Utils.useOnMount(() => {
    const isSaved = Utils.atom(true)
    const onMessage = e => {
      switch (e.data) {
        case 'close': return onClose()
        case 'saved': return isSaved.set(true)
        case 'dirty': return isSaved.set(false)
        default:
      }
    }
    const saveNotebook = () => {
      frameRef.current.contentWindow.postMessage('save', '*')
    }
    const onBeforeUnload = e => {
      if (!isSaved.get()) {
        saveNotebook()
        e.preventDefault()
      }
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('beforeunload', onBeforeUnload)
    Nav.blockNav.set(() => new Promise(resolve => {
      if (isSaved.get()) {
        resolve()
      } else {
        saveNotebook()
        isSaved.subscribe(resolve)
      }
    }))
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('beforeunload', onBeforeUnload)
      Nav.blockNav.reset()
    }
  })
  return null
}

const PeriodicCookieSetter = ({ namespace, clusterName }) => {
  const signal = Utils.useCancellation()
  Utils.usePollingEffect(
    withErrorIgnoring(() => Ajax(signal).Jupyter.notebooks(namespace, clusterName).setCookie()),
    { ms: 15 * 60 * 1000 })
  return null
}

const NotebookEditorFrame = ({ mode, notebookName, workspace: { workspace: { namespace, name, bucketName } }, cluster: { clusterName, clusterUrl, status, labels } }) => {
  console.assert(status === 'Running', 'Expected notebook runtime to be running')
  console.assert(!labels.welderInstallFailed, 'Expected cluster to have Welder')
  const frameRef = useRef()
  const [busy, setBusy] = useState(false)
  const [notebookSetupComplete, setNotebookSetupComplete] = useState(false)

  const localBaseDirectory = `${name}/edit`
  const localSafeModeBaseDirectory = `${name}/safe`
  const cloudStorageDirectory = `gs://${bucketName}/notebooks`

  const setUpNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error setting up notebook')
  )(async () => {
    await Ajax()
      .Jupyter
      .notebooks(namespace, clusterName)
      .setStorageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, `.*\\.ipynb`)
    if (mode === 'edit' && !(await Ajax().Jupyter.notebooks(namespace, clusterName).lock(`${localBaseDirectory}/${notebookName}`))) {
      notify('error', 'Unable to Edit Notebook', {
        message: 'Another user is currently editing this notebook. You can run it in Playground Mode or make a copy.'
      })
      chooseMode(undefined)
    } else {
      await Promise.all([
        Ajax().Jupyter.notebooks(namespace, clusterName).localize([{
          sourceUri: `${cloudStorageDirectory}/${notebookName}`,
          localDestinationPath: mode === 'edit' ? `${localBaseDirectory}/${notebookName}` : `${localSafeModeBaseDirectory}/${notebookName}`
        }]),
        Ajax().Jupyter.notebooks(namespace, clusterName).setCookie()
      ])
      setNotebookSetupComplete(true)
    }
  })

  Utils.useOnMount(() => {
    setUpNotebook()
  })

  return h(Fragment, [
    notebookSetupComplete && h(Fragment, [
      h(PeriodicCookieSetter, { namespace, clusterName }),
      iframe({
        src: `${clusterUrl}/notebooks/${mode === 'edit' ? localBaseDirectory : localSafeModeBaseDirectory}/${notebookName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-notebooks', { namespace, name })
      })
    ]),
    busy && h(StatusMessage, ['Copying notebook to runtime environment, almost ready...'])
  ])
}

const WelderDisabledNotebookEditorFrame = ({ mode, notebookName, workspace: { workspace: { namespace, name, bucketName } }, cluster: { clusterName, clusterUrl, status, labels } }) => {
  console.assert(status === 'Running', 'Expected notebook runtime to be running')
  console.assert(!!labels.welderInstallFailed, 'Expected cluster to not have Welder')
  const frameRef = useRef()
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState(false)
  const [localized, setLocalized] = useState(false)

  const localizeNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error copying notebook')
  )(async () => {
    if (mode === 'edit') {
      notify('error', 'Cannot Edit Notebook', {
        message: h(Fragment, [
          p(['Recent updates to Terra are not compatible with the older notebook runtime in this workspace. Please recreate your runtime in order to access Edit Mode for this notebook.']),
          h(Link, {
            variant: 'light',
            href: dataSyncingDocUrl,
            ...Utils.newTabLinkProps
          }, ['Read here for more details.'])
        ])
      })
      chooseMode(undefined)
    } else {
      await Promise.all([
        Ajax(signal).Jupyter.notebooks(namespace, clusterName).oldLocalize({
          [`~/${name}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
        }),
        Ajax(signal).Jupyter.notebooks(namespace, clusterName).setCookie()
      ])
      setLocalized(true)
    }
  })

  Utils.useOnMount(() => {
    localizeNotebook()
  })

  return h(Fragment, [
    h(PlaygroundHeader),
    localized && h(Fragment, [
      iframe({
        src: `${clusterUrl}/notebooks/${name}/${notebookName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-notebooks', { namespace, name })
      })
    ]),
    busy && h(StatusMessage, ['Copying notebook to runtime environment, almost ready...'])
  ])
}

export const navPaths = [
  {
    name: 'workspace-notebook-launch',
    path: '/workspaces/:namespace/:name/notebooks/launch/:notebookName',
    component: NotebookLauncher,
    title: ({ name, notebookName }) => `${notebookName} - ${name}`
  }
]
