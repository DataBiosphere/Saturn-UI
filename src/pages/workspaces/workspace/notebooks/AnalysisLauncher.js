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
import {
  AnalysisDuplicator,
  findPotentialNotebookLockers,
  getDisplayName,
  getTool, notebookLockHash
} from 'src/components/notebook-utils'
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
import ExportAnalysisModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const chooseMode = mode => {
  Nav.history.replace({ search: qs.stringify({ mode }) })
}

const AnalysisLauncher = _.flow(
  Utils.forwardRefWithName('AnalysisLauncher'),
  requesterPaysWrapper({
    onDismiss: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name })
  }),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceTab(props, 'analyses'),
    title: _.get('analysisName'),
    showTabBar: false
  })
)(
  ({ queryParams, analysisName, workspace, workspace: { workspace: { namespace, name }, accessLevel, canCompute }, runtimes, persistentDisks, refreshRuntimes },
    ref) => {
    const [createOpen, setCreateOpen] = useState(false)
    const runtime = getCurrentRuntime(runtimes)
    const { runtimeName, labels } = runtime || {}
    const status = getConvertedRuntimeStatus(runtime)
    const [busy, setBusy] = useState()
    const { mode } = queryParams
    const toolLabel = getTool(analysisName)

    return h(Fragment, [
      (Utils.canWrite(accessLevel) && canCompute && !!mode && _.includes(status, usableStatuses) && labels.tool === 'Jupyter') ?
        h(labels.welderInstallFailed ? WelderDisabledNotebookEditorFrame : AnalysisEditorFrame,
          { key: runtimeName, workspace, runtime, analysisName, mode, toolLabel }) :
        h(Fragment, [
          h(PreviewHeader, { queryParams, runtime, analysisName, toolLabel, workspace, readOnlyAccess: !(Utils.canWrite(accessLevel) && canCompute), onCreateRuntime: () => setCreateOpen(true) }),
          h(AnalysisPreviewFrame, { analysisName, toolLabel, workspace })
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
        onClick: () => onDismiss()
      }, ['Cancel']),
      h(ButtonSecondary, {
        style: { padding: '0 1rem', marginLeft: '1rem' },
        onClick: () => onPlayground()
      }, ['Run in playground mode']),
      h(ButtonPrimary, {
        style: { padding: '0 1rem', marginLeft: '2rem' },
        onClick: () => onRecreateRuntime()
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

const PreviewHeader = ({ queryParams, runtime, readOnlyAccess, onCreateRuntime, analysisName, toolLabel, workspace, workspace: { canShare, workspace: { namespace, name, bucketName } } }) => {
  const signal = Utils.useCancellation()
  const { user: { email } } = Utils.useStore(authStore)
  const [fileInUseOpen, setFileInUseOpen] = useState(false)
  const [editModeDisabledOpen, setEditModeDisabledOpen] = useState(false)
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockedBy, setLockedBy] = useState(null)
  const [exportingAnalysis, setExportingAnalysis] = useState(false)
  const [copyingAnalysis, setCopyingAnalysis] = useState(false)
  const runtimeStatus = getConvertedRuntimeStatus(runtime)
  const welderEnabled = runtime && !runtime.labels.welderInstallFailed
  const { mode } = queryParams
  const analysisLink = Nav.getLink('workspace-analysis-launch', { namespace, name, analysisName })

  const checkIfLocked = withErrorReporting('Error checking analysis lock status', async () => {
    const { metadata: { lastLockedBy, lockExpiresAt } = {} } = await Ajax(signal).Buckets.analysis(namespace, bucketName, getDisplayName(analysisName), toolLabel).getObject()
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
      [readOnlyAccess, () => h(HeaderButton, { onClick: () => setExportingAnalysis(true) },
        [makeMenuIcon('export'), 'Copy to another workspace']
      )],
      //TODO: THIS CONDITIONAL should look for Jupyter or Rstudio
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
            h(MenuButton, { onClick: () => setCopyingAnalysis(true) }, ['Make a Copy']),
            h(MenuButton, { onClick: () => setExportingAnalysis(true) }, ['Copy to another workspace']),
            h(MenuButton, {
              onClick: withErrorReporting('Error copying to clipboard', async () => {
                await clipboard.writeText(`${window.location.host}/${analysisLink}`)
                notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 })
              })
            }, ['Copy URL to clipboard'])
          ]),
          side: 'bottom'
        }, [
          h(HeaderButton, {}, [icon('ellipsis-v')])
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
        'aria-label': 'Exit preview mode',
        style: { opacity: 0.65, marginRight: '1.5rem' },
        hover: { opacity: 1 }, focus: 'hover',
        onClick: () => Nav.goToPath('workspace-analyses', { namespace, name })
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
        setCopyingAnalysis(true)
      },
      onPlayground: () => {
        setFileInUseOpen(false)
        chooseMode('playground')
      }
    }),
    copyingAnalysis && h(AnalysisDuplicator, {
      printName: getDisplayName(analysisName),
      toolLabel: getTool(analysisName),
      fromLauncher: true,
      wsName: name, namespace, bucketName, destroyOld: false,
      onDismiss: () => setCopyingAnalysis(false),
      onSuccess: () => setCopyingAnalysis(false)
    }),
    exportingAnalysis && h(ExportAnalysisModal, {
      printName: getDisplayName(analysisName),
      toolLabel: getTool(analysisName), workspace,
      fromLauncher: true,
      onDismiss: () => setExportingAnalysis(false)
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

const AnalysisPreviewFrame = ({ analysisName, toolLabel, workspace: { workspace: { namespace, bucketName } }, onRequesterPaysError }) => {
  const signal = Utils.useCancellation()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState()
  const frame = useRef()

  const loadPreview = _.flow(
    Utils.withBusyState(setBusy),
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error previewing analysis')
  )(async () => {
    //TODO: this call may not be right, ensure file extension/toolLabel is correct
    setPreview(await Ajax(signal).Buckets.analysis(namespace, bucketName, analysisName, toolLabel).preview())
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
        title: 'Preview for analysis'
      })
    ]),
    busy && div({ style: { margin: '0.5rem 2rem' } }, ['Generating preview...'])
  ])
}

//TODO: this ensures that navigating away from the Jupyter iframe results in a save via a custom extension located in `jupyter-iframe-extension`
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

const copyingAnalysisMessage = div({ style: { paddingTop: '2rem' } }, [
  h(StatusMessage, ['Copying analysis to cloud environment, almost ready...'])
])

const AnalysisEditorFrame = ({ mode, analysisName, toolLabel, workspace: { workspace: { namespace, name, bucketName } }, runtime: { runtimeName, proxyUrl, status, labels } }) => {
  console.assert(_.includes(status, usableStatuses), `Expected cloud environment to be one of: [${usableStatuses}]`)
  console.assert(!labels.welderInstallFailed, 'Expected cloud environment to have Welder')
  const frameRef = useRef()
  const [busy, setBusy] = useState(false)
  const [notebookSetupComplete, setNotebookSetupComplete] = useState(false)
  const cookieReady = Utils.useStore(cookieReadyStore)

  const localBaseDirectory = `${name}/edit`
  const localSafeModeBaseDirectory = `${name}/safe`
  //TODO: should this vary on toolLabel? (As of right now, the answer is no because the VM path will be `/home/rstudio`, but the bucket path for all analyses will be `/notebooks`, but design still WIP)
  const cloudStorageDirectory = `gs://${bucketName}/notebooks`

  //TODO: see inline TODOs, may require call-site change too
  const setUpNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error setting up analysis')
  )(async () => {
    await Ajax()
    //TODO: use proper welder calls
      .Runtimes
      .notebooks(namespace, runtimeName)
      .setStorageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, `.*\\.ipynb`)
    if (mode === 'edit' && !(await Ajax().Runtimes.notebooks(namespace, runtimeName).lock(`${localBaseDirectory}/${analysisName}`))) {
      notify('error', 'Unable to Edit Analysis', {
        message: 'Another user is currently editing this analysis. You can run it in Playground Mode or make a copy.'
      })
      chooseMode(undefined)
    } else {
      //TODO use proper welder calls
      await Ajax().Runtimes.notebooks(namespace, runtimeName).localize([{
        sourceUri: `${cloudStorageDirectory}/${analysisName}`,
        localDestinationPath: mode === 'edit' ? `${localBaseDirectory}/${analysisName}` : `${localSafeModeBaseDirectory}/${analysisName}`
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
        //TODO: this may vary based on tool.
        src: `${proxyUrl}/notebooks/${mode === 'edit' ? localBaseDirectory : localSafeModeBaseDirectory}/${analysisName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      //TODO: this frame will most likely vary based on tool. See comment attached to `JupyterFrameManager`
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-analyses', { namespace, name }),
        details: { analysisName, name, namespace }
      })
    ]),
    busy && copyingAnalysisMessage
  ])
}

//TODO: this originally was designed to handle VMs that didn't have welder deployed on them
// do we need this anymore? (can be queried in prod DB to see if there are any VMs with welderEnabled=false with a `recent` dateAccessed
// do we need to support this for rstudio? I don't think so because welder predates RStudio support, but not 100%
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
      //TODO: does this link need to change?
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
        //TODO: does this link need to change?
        src: `${proxyUrl}/notebooks/${name}/${notebookName}`,
        style: { border: 'none', flex: 1 },
        ref: frameRef
      }),
      h(JupyterFrameManager, {
        frameRef,
        onClose: () => Nav.goToPath('workspace-analyses', { namespace, name }),
        details: { notebookName, name, namespace }
      })
    ]),
    busy && copyingAnalysisMessage
  ])
}

export const navPaths = [
  {
    name: 'workspace-analysis-launch',
    path: '/workspaces/:namespace/:name/analysis/launch/:analysisName',
    component: AnalysisLauncher,
    title: ({ name, analysisName }) => `${analysisName} - ${name}`
  }
]
