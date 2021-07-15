import * as clipboard from 'clipboard-polyfill/text'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { Fragment, useRef, useState } from 'react'
import { b, div, h, iframe, p, span } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import { ButtonPrimary, ButtonSecondary, Clickable, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { NewRuntimeModal } from 'src/components/NewRuntimeModal'
import { findPotentialNotebookLockers, NotebookDuplicator, notebookLockHash } from 'src/components/notebook-utils'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import { ApplicationHeader, PlaygroundHeader, RuntimeKicker, RuntimeStatusMonitor, StatusMessage } from 'src/components/runtime-common'
import { dataSyncingDocUrl } from 'src/data/machines'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import { notify } from 'src/libs/notifications'
import { getLocalPref, setLocalPref } from 'src/libs/prefs'
import { getConvertedRuntimeStatus, getCurrentRuntime, usableStatuses } from 'src/libs/runtime-utils'
import { authStore, cookieReadyStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import ExportNotebookModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const chooseMode = mode => {
  Nav.history.replace({ search: qs.stringify({ mode }) })
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
  ({ queryParams, notebookName, workspace, workspace: { workspace: { namespace, name }, accessLevel, canCompute }, runtimes, persistentDisks, refreshRuntimes },
    ref) => {
    const [createOpen, setCreateOpen] = useState(false)
    const runtime = getCurrentRuntime(runtimes)
    const { runtimeName, labels } = runtime || {}
    const status = getConvertedRuntimeStatus(runtime)
    const [busy, setBusy] = useState()
    const { mode } = queryParams

    return h(Fragment, [
      (Utils.canWrite(accessLevel) && canCompute && !!mode && _.includes(status, usableStatuses) && labels.tool === 'Jupyter') ?
        h(labels.welderInstallFailed ? WelderDisabledNotebookEditorFrame : NotebookEditorFrame,
          { key: runtimeName, workspace, runtime, notebookName, mode }) :
        h(Fragment, [
          h(PreviewHeader, { queryParams, runtime, notebookName, workspace, readOnlyAccess: !(Utils.canWrite(accessLevel) && canCompute), onCreateRuntime: () => setCreateOpen(true) }),
          h(NotebookPreviewFrame, { notebookName, workspace })
        ]),
      mode && h(RuntimeKicker, { runtime, refreshRuntimes, onNullRuntime: () => setCreateOpen(true) }),
      mode && h(RuntimeStatusMonitor, { runtime, onRuntimeStoppedRunning: () => chooseMode(undefined) }),
      h(NewRuntimeModal, {
        isOpen: createOpen,
        workspace,
        runtimes,
        persistentDisks,
        onDismiss: () => {
          chooseMode(undefined)
          setCreateOpen(false)
        },
        onSuccess: _.flow(
          withErrorReporting('Error creating runtime'),
          Utils.withBusyState(setBusy)
        )(async () => {
          setCreateOpen(false)
          await refreshRuntimes(true)
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
        onClick: onDismiss
      }, ['Cancel']),
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: onCopy
      }, ['Make a copy']),
      h(ButtonPrimary, {
        onClick: onPlayground
      }, ['Run in playground mode'])
    ])
  ])
}

const EditModeDisabledModal = ({ onDismiss, onRecreateRuntime, onPlayground }) => {
  return h(Modal, {
    width: 700,
    title: 'Cannot Edit Notebook',
    onDismiss,
    showButtons: false
  }, [
    p('We’ve released important updates that are not compatible with the older cloud environment associated with this workspace. To enable Edit Mode, please delete your existing cloud environment and create a new cloud environment.'),
    p('If you have any files on your old cloud environment that you want to keep, you can access your old cloud environment using the Playground Mode option.'),
    h(Link, {
      href: dataSyncingDocUrl,
      ...Utils.newTabLinkProps
    }, ['Read here for more details.']),
    div({ style: { marginTop: '2rem' } }, [
      h(ButtonSecondary, {
        style: { padding: '0 1rem' },
        onClick: onDismiss
      }, ['Cancel']),
      h(ButtonSecondary, {
        style: { padding: '0 1rem', marginLeft: '1rem' },
        onClick: onPlayground
      }, ['Run in playground mode']),
      h(ButtonPrimary, {
        style: { padding: '0 1rem', marginLeft: '2rem' },
        onClick: onRecreateRuntime
      }, ['Recreate cloud environment'])
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

const HeaderButton = ({ children, ...props }) => h(ButtonSecondary, {
  style: { padding: '1rem', backgroundColor: colors.dark(0.1), height: '100%', marginRight: 2 }, ...props
}, [children])

const PreviewHeader = ({ queryParams, runtime, readOnlyAccess, onCreateRuntime, notebookName, workspace, workspace: { canShare, workspace: { namespace, name, bucketName } } }) => {
  const signal = Utils.useCancellation()
  const { user: { email } } = Utils.useStore(authStore)
  const [fileInUseOpen, setFileInUseOpen] = useState(false)
  const [editModeDisabledOpen, setEditModeDisabledOpen] = useState(false)
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState(null)
  const [exportingNotebook, setExportingNotebook] = useState(false)
  const [copyingNotebook, setCopyingNotebook] = useState(false)
  const runtimeStatus = getConvertedRuntimeStatus(runtime)
  const welderEnabled = runtime && !runtime.labels.welderInstallFailed
  const { mode } = queryParams
  const notebookLink = Nav.getLink('workspace-notebook-launch', { namespace, name, notebookName })

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

  return h(ApplicationHeader, {
    label: 'PREVIEW (READ-ONLY)',
    labelBgColor: colors.dark(0.2)
  }, [
    Utils.cond(
      [readOnlyAccess, () => h(HeaderButton, { onClick: () => setExportingNotebook(true) },
        [makeMenuIcon('export'), 'Copy to another workspace']
      )],
      [!!runtimeStatus && runtime.labels.tool !== 'Jupyter', () => h(StatusMessage, { hideSpinner: true }, [
        'Your cloud compute doesn\'t appear to be running Jupyter. Create a new cloud environment with Jupyter on it to edit this notebook.'
      ])],
      [!mode || [null, 'Stopped'].includes(runtimeStatus), () => h(Fragment, [
        Utils.cond(
          [runtime && !welderEnabled, () => h(HeaderButton, {
            onClick: () => setEditModeDisabledOpen(true)
          }, [makeMenuIcon('warning-standard'), 'Edit (Disabled)'])],
          [locked, () => h(HeaderButton, {
            onClick: () => setFileInUseOpen(true)
          }, [makeMenuIcon('lock'), 'Edit (In use)'])],
          () => h(HeaderButton, {
            onClick: () => chooseMode('edit')
          }, [makeMenuIcon('edit'), 'Edit'])
        ),
        h(HeaderButton, {
          onClick: () => getLocalPref('hidePlaygroundMessage') ? chooseMode('playground') : setPlaygroundModalOpen(true)
        }, [makeMenuIcon('chalkboard'), 'Playground mode']),
        h(MenuTrigger, {
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
          h(HeaderButton, {}, [icon('ellipsis-v', { 'aria-label': 'notebook menu' })])
        ])
      ])],
      [_.includes(runtimeStatus, usableStatuses), () => {
        console.assert(false, `Expected cloud environment to NOT be one of: [${usableStatuses}]`)
        return null
      }],
      [runtimeStatus === 'Creating', () => h(StatusMessage, [
        'Creating cloud environment. You can navigate away and return in 3-5 minutes.'
      ])],
      [runtimeStatus === 'Starting', () => h(StatusMessage, [
        'Starting cloud environment, this may take up to 2 minutes.'
      ])],
      [runtimeStatus === 'Stopping', () => h(StatusMessage, [
        'Cloud environment is stopping, which takes ~4 minutes. You can restart it after it finishes.'
      ])],
      [runtimeStatus === 'LeoReconfiguring', () => h(StatusMessage, [
        'Cloud environment is updating, please wait.'
      ])],
      [runtimeStatus === 'Error', () => h(StatusMessage, { hideSpinner: true }, ['Cloud environment error.'])]
    ),
    div({ style: { flexGrow: 1 } }),
    div({ style: { position: 'relative' } }, [
      h(Clickable, {
        tooltip: 'Exit preview mode',
        style: { opacity: 0.65, marginRight: '1.5rem' },
        hover: { opacity: 1 }, focus: 'hover',
        onClick: () => Nav.goToPath('workspace-notebooks', { namespace, name })
      }, [icon('times-circle', { size: 30 })])
    ]),
    editModeDisabledOpen && h(EditModeDisabledModal, {
      onDismiss: () => setEditModeDisabledOpen(false),
      onRecreateRuntime: () => {
        setEditModeDisabledOpen(false)
        onCreateRuntime()
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
          doc.addEventListener('mousedown', () => window.document.dispatchEvent(new MouseEvent('mousedown')))
        },
        style: { border: 'none', flex: 1 },
        srcDoc: preview,
        title: 'Preview for notebook'
      })
    ]),
    busy && div({ style: { margin: '0.5rem 2rem' } }, ['Generating preview...'])
  ])
}

const JupyterFrameManager = ({ onClose, frameRef, details = {} }) => {
  Utils.useOnMount(() => {
    Ajax().Metrics.captureEvent(Events.notebookLaunch, { 'Notebook Name': details.notebookName, 'Workspace Name': details.name, 'Workspace Namespace': details.namespace })

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

const copyingNotebookMessage = div({ style: { paddingTop: '2rem' } }, [
  h(StatusMessage, ['Copying notebook to cloud environment, almost ready...'])
])

const NotebookEditorFrame = ({ mode, notebookName, workspace: { workspace: { namespace, name, bucketName } }, runtime: { runtimeName, proxyUrl, status, labels } }) => {
  console.assert(_.includes(status, usableStatuses), `Expected cloud environment to be one of: [${usableStatuses}]`)
  console.assert(!labels.welderInstallFailed, 'Expected cloud environment to have Welder')
  const frameRef = useRef()
  const [busy, setBusy] = useState(false)
  const [notebookSetupComplete, setNotebookSetupComplete] = useState(false)
  const cookieReady = Utils.useStore(cookieReadyStore)

  const localBaseDirectory = `${name}/edit`
  const localSafeModeBaseDirectory = `${name}/safe`
  const cloudStorageDirectory = `gs://${bucketName}/notebooks`

  const setUpNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error setting up notebook')
  )(async () => {
    await Ajax()
      .Runtimes
      .notebooks(namespace, runtimeName)
      .setStorageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, `.*\\.ipynb`)
    if (mode === 'edit' && !(await Ajax().Runtimes.notebooks(namespace, runtimeName).lock(`${localBaseDirectory}/${notebookName}`))) {
      notify('error', 'Unable to Edit Notebook', {
        message: 'Another user is currently editing this notebook. You can run it in Playground Mode or make a copy.'
      })
      chooseMode(undefined)
    } else {
      await Ajax().Runtimes.notebooks(namespace, runtimeName).localize([{
        sourceUri: `${cloudStorageDirectory}/${notebookName}`,
        localDestinationPath: mode === 'edit' ? `${localBaseDirectory}/${notebookName}` : `${localSafeModeBaseDirectory}/${notebookName}`
      }])
      setNotebookSetupComplete(true)
    }
  })

  Utils.useOnMount(() => {
    setUpNotebook()
  })

  return h(Fragment, [
    notebookSetupComplete && cookieReady && h(Fragment, [
      iframe({
        src: `${proxyUrl}/notebooks/${mode === 'edit' ? localBaseDirectory : localSafeModeBaseDirectory}/${notebookName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-notebooks', { namespace, name }),
        details: { notebookName, name, namespace }
      })
    ]),
    busy && copyingNotebookMessage
  ])
}

const WelderDisabledNotebookEditorFrame = ({ mode, notebookName, workspace: { workspace: { namespace, name, bucketName } }, runtime: { runtimeName, proxyUrl, status, labels } }) => {
  console.assert(status === 'Running', 'Expected cloud environment to be running')
  console.assert(!!labels.welderInstallFailed, 'Expected cloud environment to not have Welder')
  const frameRef = useRef()
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState(false)
  const [localized, setLocalized] = useState(false)
  const cookieReady = Utils.useStore(cookieReadyStore)

  const localizeNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error copying notebook')
  )(async () => {
    if (mode === 'edit') {
      notify('error', 'Cannot Edit Notebook', {
        message: h(Fragment, [
          p(['Recent updates to Terra are not compatible with the older cloud environment in this workspace. Please recreate your cloud environment in order to access Edit Mode for this notebook.']),
          h(Link, { href: dataSyncingDocUrl, ...Utils.newTabLinkProps }, ['Read here for more details.'])
        ])
      })
      chooseMode(undefined)
    } else {
      await Ajax(signal).Runtimes.notebooks(namespace, runtimeName).oldLocalize({
        [`~/${name}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
      })
      setLocalized(true)
    }
  })

  Utils.useOnMount(() => {
    localizeNotebook()
  })

  return h(Fragment, [
    h(PlaygroundHeader, [
      'Edits to this notebook are ',
      b(['NOT ']),
      'being saved to the workspace. To save your changes, download the notebook using the file menu.',
      h(Link, {
        style: { marginLeft: '0.5rem' },
        href: dataSyncingDocUrl,
        ...Utils.newTabLinkProps
      }, ['Read here for more details.'])
    ]),
    localized && cookieReady && h(Fragment, [
      iframe({
        src: `${proxyUrl}/notebooks/${name}/${notebookName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-notebooks', { namespace, name }),
        details: { notebookName, name, namespace }
      })
    ]),
    busy && copyingNotebookMessage
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
