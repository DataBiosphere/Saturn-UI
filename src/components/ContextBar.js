import { Fragment, useState } from 'react'
import { div, h, hr, img, span } from 'react-hyperscript-helpers'
import { Clickable, comingSoon, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import colors, { terraSpecial } from 'src/libs/colors'
import * as Style from 'src/libs/style'
import ModalDrawer, { withModalDrawer } from 'src/components/ModalDrawer'
import TitleBar from 'src/components/TitleBar'
import * as Utils from 'src/libs/utils'
import _ from 'lodash/fp'
import { NewRuntimeModalBase } from 'src/components/NewRuntimeModal'
import { withErrorReporting } from 'src/libs/error'
import { NewGalaxyModalBase } from 'src/components/NewGalaxyModal'
import { tools } from 'src/components/notebook-utils'
import galaxyLogo from 'src/images/galaxy-logo.png'
import jupyterLogo from 'src/images/jupyter-logo-long.png'
import rstudioLogo from 'src/images/rstudio-logo.svg'
import launchIcon from 'src/images/launch.svg'
import { collapsedRuntimeStatus, getCurrentApp, getCurrentRuntime } from 'src/libs/runtime-utils'


const contextBarStyles = {
  contextBarContainer: {
    display: 'flex', flexWrap: 'wrap'
  },
  contextBarButton: {
    display: 'flex',
    borderBottom: `1px solid ${colors.accent()}`,
    padding: '1rem',
    color: colors.accent(),
    backgroundColor: colors.accent(0.2)
  }
}

const titleId = 'cloud-env-modal'

const CloudEnvironmentModal = ({ isOpen, onDismiss, onSuccess, canCompute, runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps, workspace, persistentDisks, workspace: { workspace: { namespace, bucketName, name: workspaceName } } }) => {
  const [viewMode, setViewMode] = useState(undefined)
  const [busy, setBusy] = useState()

  const noCompute = 'You do not have access to run analyses on this workspace.'

  const renderNewRuntimeModal = tool => h(NewRuntimeModalBase, {
    isOpen: true, //always true, this is detached from dom for other viewmodes within this modal
    isAnalysisMode: true,
    workspace,
    tool,
    runtimes,
    persistentDisks,
    onDismiss,
    onSuccess: _.flow(
      withErrorReporting('Error creating runtime'),
      Utils.withBusyState(setBusy)
    )(async () => {
      onSuccess()
      await refreshRuntimes(true)
    })
  })

  const renderNewGalaxyModal = () => h(NewGalaxyModalBase, {
    isOpen: true,
    isAnalysisMode: true,
    workspace,
    apps,
    galaxyDataDisks,
    onDismiss,
    onSuccess: _.flow(
      withErrorReporting('Error creating app'),
      Utils.withBusyState(setBusy)
    )(async () => {
      onSuccess()
      await refreshApps(true)
    })
  })

  const renderDefaultPage = () => div({ style: { display: 'flex', flexDirection: 'column', flex: 1 } }, [
    renderToolButtons(tools.Jupyter.label),
    renderToolButtons(tools.RStudio.label),
    renderToolButtons(tools.galaxy.label)
  ])

  // const appIconSrc = Utils.switchCase(toolLabel, [tools.Jupyter.label, () => jupyterLogo], [tools.RStudio.label, () => rLogo])
  // const appIcon = div({ style: { marginRight: '1rem' } }, [
  //   img({ src: appIconSrc, style: { height: 40, width: 40 } })
  // ])

  //TODO shorthand margin and padding
  const toolPanelStyles = { backgroundColor: 'white', marginBottom: '1rem', marginLeft: '1.5rem', marginRight: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column' }
  const toolLabelStyles = { marginTop: '1rem', marginBottom: '.5rem', display: 'flex', flexDirection: 'row', alignItems: 'center' }
  const toolButtonDivStyles = { display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly' }
  const toolButtonStyles = { flex: '1 1 0%', maxWidth: 100, display: 'flex', flexDirection: 'column', border: '.5px solid grey', borderRadius: 16, paddingRight: '.75rem', paddingLeft: '.75rem', paddingTop: '.5rem', paddingBottom: '.5rem', alignItems: 'center', fontWeight: 550, fontSize: 11, color: colors.accent() }

  const currentRuntime = getCurrentRuntime(runtimes)
  const currentRuntimeStatus = collapsedRuntimeStatus(currentRuntime)
  const currentTool = currentRuntime?.label?.tool
  console.log(currentRuntime)

  const currentApp = getCurrentApp(apps)

  const RuntimeIcon = ({ shape, onClick, disabled, messageChildren, toolLabel, style, ...props }) => {
    return h(Clickable, {
      'aria-label': `${toolLabel} Status`,
      hover: { backgroundColor: colors.accent(0.2) },
      tooltip: '', //TODO
      tooltipDelay: 100,
      //css takes the last thing, the order here is important because all three things can specify color
      style: { ...toolButtonStyles, color: onClick && !disabled ? colors.accent() : colors.dark(0.7), ...style },
      onClick, disabled, ...props
    }, [
      icon(shape, { size: 20 }),
      ...messageChildren
    ])
  }

  const startRuntime = () => {}
  const stopRuntime = () => {}

  const renderStatusClickable = (toolLabel) => {
    switch (currentRuntimeStatus) {
      case 'Stopped':
        return h(RuntimeIcon, {
          shape: 'play',
          toolLabel,
          onClick: () => startRuntime(), //TODO
          disabled: busy || !canCompute,
          messageChildren: [span('Resume'),
            span('compute')],
          tooltip: canCompute ? 'Start cloud environment' : noCompute
        })
      case 'Running':
        return h(RuntimeIcon, {
          shape: 'pause',
          toolLabel,
          onClick: () => stopRuntime(), //TODO
          disabled: busy || !canCompute,
          messageChildren: [span('Pause'),
            span('compute')],
          tooltip: canCompute ? 'Stop cloud environment' : noCompute
        })
      case 'Starting':
      case 'Stopping':
      case 'Updating':
      case 'Creating':
      case 'LeoReconfiguring':
        return h(RuntimeIcon, {
          shape: 'sync',
          toolLabel,
          disabled: true,
          tooltip: 'Cloud environment update in progress',
          messageChildren: [span('Update'),
            span('In Progress')]
        })
      case 'Error':
        return h(RuntimeIcon, {
          shape: 'warning-standard',
          toolLabel,
          style: { color: colors.danger(0.9) },
          onClick: () => {}, //TODO: see runtimemanager, this.setState({ errorModalOpen: true }),
          disabled: busy || !canCompute,
          messageChildren: [span('View'),
            span('Error')],
          tooltip: canCompute ? 'View error' : noCompute
        })
      default:
        return h(RuntimeIcon, {
          shape: 'pause',
          toolLabel,
          disabled: true,
          messageChildren: [span('Pause'),
            span('compute')],
          tooltip: 'No environment found'
        })
    }
  }

  const getToolIcon = toolLabel => Utils.switchCase(toolLabel,
    [tools.Jupyter.label, () => jupyterLogo],
    [tools.galaxy.label, () => galaxyLogo],
    [tools.RStudio.label, () => rstudioLogo])


  const renderToolButtons = (toolLabel) => h(Fragment, [
    //Jupyter Panel
    div({ style: toolPanelStyles }, [
      div({ style: toolLabelStyles }, [
        //TODO generalize label
        img({ src: getToolIcon(toolLabel), style: { height: 20, marginRight: '1rem' } }),
        'Running $0.20/hr' //TODO: make dynamic
      ]),
      div({ style: toolButtonDivStyles }, [
        h(Clickable, {
          'aria-label': `${toolLabel} Env`,
          style: toolButtonStyles,
          hover: { backgroundColor: colors.accent(0.2) },
          tooltip: '', //TODO
          tooltipDelay: 100,
          onClick: () => setViewMode(toolLabel)
        }, [
          icon('cloudBolt', { size: 20 }),
          span('Cloud'),
          span('Environment')
        ]),
        renderStatusClickable(toolLabel),
        h(Clickable, {
          'aria-label': `Launch ${toolLabel}`,
          //TODO color based on disabled !disabled ? colors.accent() : colors.dark(0.7)
          style: toolButtonStyles,
          hover: { backgroundColor: colors.accent(0.2) },
          tooltip: '', //TODO
          tooltipDelay: 100,
          onClick: () => {} //TODO
        }, [
          img({src: launchIcon, size: 20 }),
          span('Launch'),
          span(toolLabel)
        ])
      ])
    ])
  ])

  const NEW_JUPYTER_MODE = tools.Jupyter.label
  const NEW_RSTUDIO_MODE = tools.RStudio.label
  const NEW_GALAXY_MODE = tools.galaxy.label

  const getView = () => Utils.switchCase(viewMode,
    [NEW_JUPYTER_MODE, () => renderNewRuntimeModal(NEW_JUPYTER_MODE)],
    [NEW_RSTUDIO_MODE, () => renderNewRuntimeModal(NEW_RSTUDIO_MODE)],
    [NEW_GALAXY_MODE, renderNewGalaxyModal],
    [Utils.DEFAULT, renderDefaultPage]
  )

  const width = Utils.switchCase(viewMode,
    [NEW_JUPYTER_MODE, () => 675],
    [NEW_RSTUDIO_MODE, () => 675],
    [NEW_GALAXY_MODE, () => 675],
    [Utils.DEFAULT, () => 430]
  )

  const modalBody = h(Fragment, [
    h(TitleBar, {
      id: titleId,
      title: 'Cloud environment details',
      titleStyles: _.merge(viewMode === undefined ? {} : { display: 'none' }, { margin: '1.5rem 0 .5rem 1rem' }),
      width,
      onDismiss,
      onPrevious: !!viewMode ? () => setViewMode(undefined) : undefined
    }),
    // hr({ style: { borderTop: '1px solid', width: '100%', color: colors.accent() } }),
    getView(),
    busy && spinnerOverlay
  ])

  const modalProps = { isOpen, onDismiss, width, 'aria-labelledby': titleId }

  return h(ModalDrawer, { ...modalProps, children: modalBody })
}

export const ContextBar = ({ setDeletingWorkspace, setCloningWorkspace, setSharingWorkspace, isOwner, canShare, canCompute, runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps, workspace, persistentDisks, workspace: { workspace: { namespace, bucketName, name: workspaceName } } }) => {
  const [isCloudEnvOpen, setCloudEnvOpen] = useState(false)

  return h(Fragment, [
    h(CloudEnvironmentModal, {
      isOpen: isCloudEnvOpen,
      onSuccess: () => setCloudEnvOpen(false),
      onDismiss: () => setCloudEnvOpen(false),
      runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps,
      workspace,
      canCompute,
      persistentDisks
    }),
    div({ style: Style.elements.contextBarContainer }, [
      div({ style: contextBarStyles.contextBarContainer }, [
        h(MenuTrigger, {
          closeOnClick: true,
          content: h(Fragment, [
            h(MenuButton, { onClick: () => setCloningWorkspace(true) }, [makeMenuIcon('copy'), 'Clone']),
            h(MenuButton, {
              disabled: !canShare,
              tooltip: !canShare && 'You have not been granted permission to share this workspace',
              tooltipSide: 'left',
              onClick: () => setSharingWorkspace(true)
            }, [makeMenuIcon('share'), 'Share']),
            h(MenuButton, { disabled: true }, [makeMenuIcon('export'), 'Publish', comingSoon]),
            h(MenuButton, {
              disabled: !isOwner,
              tooltip: !isOwner && 'You must be an owner of this workspace or the underlying billing project',
              tooltipSide: 'left',
              onClick: () => setDeletingWorkspace(true)
            }, [makeMenuIcon('trash'), 'Delete Workspace'])
          ]),
          side: 'bottom'
        }, [
          h(Clickable, {
            'aria-label': 'Menu',
            style: contextBarStyles.contextBarButton,
            hover: { boxShadow: `inset -6px 0px ${terraSpecial(0.9)}` },
            tooltip: 'Menu',
            tooltipDelay: 100
          }, [icon('ellipsis-v', { size: 24 })])
        ]),
        h(Clickable, {
          style: contextBarStyles.contextBarButton,
          hover: { boxShadow: `inset -6px 0px ${terraSpecial(0.9)}` },
          onClick: () => setCloudEnvOpen(!isCloudEnvOpen),
          ...{ tooltip: 'Compute Configuration', tooltipDelay: 100 },
          'aria-label': 'Compute Configuration'
        }, [icon('cloudBolt', { size: 24 })]),
        h(Clickable, {
          style: contextBarStyles.contextBarButton,
          hover: { boxShadow: `inset -6px 0px ${terraSpecial(0.9)}` },
          // TODO: add click handler
          tooltip: 'Terminal',
          tooltipDelay: 100,
          'aria-label': 'Terminal'
        }, [icon('terminal', { size: 24 })])
      ])
    ])
  ])
}
