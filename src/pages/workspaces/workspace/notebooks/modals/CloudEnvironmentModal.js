import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, hr, img, span } from 'react-hyperscript-helpers'
import { ButtonPrimary, Clickable, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import ModalDrawer from 'src/components/ModalDrawer'
import { NewGalaxyModalBase } from 'src/components/NewGalaxyModal'
import { NewRuntimeModalBase } from 'src/components/NewRuntimeModal'
import { tools } from 'src/components/notebook-utils'
import { AppErrorModal, RuntimeErrorModal } from 'src/components/RuntimeManager'
import TitleBar from 'src/components/TitleBar'
import galaxyLogo from 'src/images/galaxy-logo.png'
import jupyterLogo from 'src/images/jupyter-logo-long.png'
import rstudioLogo from 'src/images/rstudio-logo.svg'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import Events from 'src/libs/events'
import {
  getConvertedRuntimeStatus, getConvertedAppStatus,
  getCurrentApp,
  getCurrentRuntime,
  getGalaxyComputeCost, getGalaxyCostTextChildren, getIsAppBusy, isCurrentGalaxyDiskDetaching, persistentDiskCost,
  runtimeCost, getIsRuntimeBusy
} from 'src/libs/runtime-utils'
import { cookieReadyStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import { formatUSD } from 'src/libs/utils'


const titleId = 'cloud-env-modal'

export const CloudEnvironmentModal = ({ isOpen, onDismiss, onSuccess, canCompute, runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps, workspace, persistentDisks, workspace: { workspace: { namespace, bucketName, name: workspaceName } } }) => {
  const [viewMode, setViewMode] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [errorRuntimeId, setErrorRuntimeId] = useState(undefined)
  const [errorAppId, setErrorAppId] = useState(undefined)
  const cookieReady = Utils.useStore(cookieReadyStore)

  const noCompute = 'You do not have access to run analyses on this workspace.'

  const renderNewRuntimeModal = tool => h(NewRuntimeModalBase, {
    isOpen: true,//viewMode === NEW_JUPYTER_MODE || viewMode === NEW_RSTUDIO_MODE,
    isAnalysisMode: true,
    workspace,
    tool,
    runtimes,
    persistentDisks,
    onDismiss: () => {
      setViewMode(undefined)
      onDismiss()
    },
    onSuccess: _.flow(
      withErrorReporting('Error creating runtime'),
      Utils.withBusyState(setBusy)
    )(async () => {
      console.log('in on success')
      setViewMode(undefined)
      await refreshRuntimes(true)
    })
  })

  const renderNewGalaxyModal = () => h(NewGalaxyModalBase, {
    isOpen: viewMode === NEW_GALAXY_MODE,
    isAnalysisMode: true,
    workspace,
    apps,
    galaxyDataDisks,
    onDismiss: () => {
      setViewMode(undefined)
      onDismiss()
    },
    onSuccess: _.flow(
      withErrorReporting('Error creating app'),
      Utils.withBusyState(setBusy)
    )(async () => {
      setViewMode(undefined)
      await refreshApps(true)
    })
  })

  const renderDefaultPage = () => div({ style: { display: 'flex', flexDirection: 'column', flex: 1 } }, [
    renderToolButtons(tools.Jupyter.label),
    renderToolButtons(tools.RStudio.label),
    renderToolButtons(tools.galaxy.label)
  ])

  //TODO shorthand margin and padding
  const toolPanelStyles = { backgroundColor: 'white', marginBottom: '1rem', marginLeft: '1.5rem', marginRight: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column' }
  const toolLabelStyles = { marginTop: '1rem', marginBottom: '.5rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
  const toolButtonDivStyles = { display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly' }
  const toolButtonStyles = { flex: '1 1 0%', maxWidth: 100, display: 'flex', flexDirection: 'column', border: '.5px solid grey', borderRadius: 16, paddingRight: '.75rem', paddingLeft: '.75rem', paddingTop: '.5rem', paddingBottom: '.5rem', alignItems: 'center', fontWeight: 550, fontSize: 11, color: colors.accent() }

  console.log(runtimes)
  const currentRuntime = getCurrentRuntime(runtimes)
  const currentRuntimeStatus = getConvertedRuntimeStatus(currentRuntime)
  const currentRuntimeTool = currentRuntime?.labels?.tool
  console.log(currentRuntime)

  const currentApp = getCurrentApp(apps)

  const RuntimeIcon = ({ shape, onClick, disabled, messageChildren, toolLabel, style, ...props }) => {
    return h(Clickable, {
      'aria-label': `${toolLabel} Status`,
      hover: { backgroundColor: colors.accent(0.2) },
      tooltipDelay: 100,
      //css takes the last thing if there are duplicate fields, the order here is important because all three things can specify color
      style: { ...toolButtonStyles, color: onClick && !disabled ? colors.accent() : colors.dark(0.7), ...style },
      onClick, disabled, ...props
    }, [
      icon(shape, { size: 20 }),
      ...messageChildren
    ])
  }

  const executeAndRefresh = async (toolLabel, promise) => {
    try {
      setBusy(true)
      await promise
      await toolLabel === tools.galaxy.label ? refreshApps() : refreshRuntimes()
    } catch (error) {
      reportError('Cloud Environment Error', error)
    } finally {
      setBusy(false)
    }
  }

  //We assume here that button disabling is working properly, so the only thing to check is whether its galaxy or the current (assumed to be existing) runtime
  const startApp = toolLabel => Utils.cond([toolLabel === tools.galaxy.label, () => {
    const { googleProject, appName } = currentApp
    executeAndRefresh(toolLabel,
      Ajax().Apps.app(googleProject, appName).resume())
  }], [Utils.DEFAULT, () => {
    const { googleProject, runtimeName } = currentRuntime
    executeAndRefresh(toolLabel,
      Ajax().Runtimes.runtime(googleProject, runtimeName).start())
  }])

  const stopApp = toolLabel => Utils.cond([toolLabel === tools.galaxy.label, () => {
    const { googleProject, appName } = currentApp
    executeAndRefresh(toolLabel,
      Ajax().Apps.app(googleProject, appName).pause())
  }], [Utils.DEFAULT, () => {
    const { googleProject, runtimeName } = currentRuntime
    executeAndRefresh(toolLabel,
      Ajax().Runtimes.runtime(googleProject, runtimeName).stop())
  }])

  const defaultIcon = toolLabel => h(RuntimeIcon, {
    shape: 'pause',
    toolLabel,
    disabled: true,
    messageChildren: [span('Pause'),
      span('compute')],
    tooltip: 'No app found'
  })

  const renderStatusClickable = toolLabel => Utils.cond(
    [toolLabel === currentRuntimeTool, () => getIconFromRuntimeStatus(toolLabel, currentRuntimeStatus)],
    [toolLabel === tools.galaxy.label, () => {
      const normalizedAppStatus = _.capitalize(currentApp?.status)
      return getIconFromRuntimeStatus(toolLabel, normalizedAppStatus)
    }],
    [Utils.DEFAULT, () => defaultIcon(toolLabel)]
  )

  const getIconFromRuntimeStatus = (toolLabel, status) => {
    //We dont use Utils.switchCase here to support the 'fallthrough' functionality
    switch (status) {
      case 'Stopped':
        return h(RuntimeIcon, {
          shape: 'play',
          toolLabel,
          onClick: () => startApp(toolLabel),
          disabled: busy || !canCompute,
          messageChildren: [span('Resume'),
            span('compute')],
          tooltip: canCompute ? 'Start app' : noCompute
        })
      case 'Running':
        return h(RuntimeIcon, {
          shape: 'pause',
          toolLabel,
          onClick: () => stopApp(toolLabel),
          disabled: busy || !canCompute,
          messageChildren: [span('Pause'),
            span('compute')],
          tooltip: canCompute ? 'Stop app' : noCompute
        })
      case 'Starting':
      case 'Stopping':
      case 'Updating':
      case 'Creating':
      case 'Prestopping':
      case 'Prestarting':
      case 'Precreating':
      case 'Provisioning':
      case 'LeoReconfiguring':
        return h(RuntimeIcon, {
          shape: 'sync',
          toolLabel,
          disabled: true,
          tooltip: 'App update in progress',
          messageChildren: [span('Compute'),
            span(toolLabel === tools.galaxy.label ? getConvertedAppStatus(_.upperCase(status)) : status)]
        })
      case 'Error':
        return h(RuntimeIcon, {
          shape: 'warning-standard',
          toolLabel,
          style: { color: colors.danger(0.9) },
          onClick: () => {
            Utils.cond(
              [toolLabel === tools.galaxy.label, () => setErrorAppId(currentApp?.appName)],
              [Utils.DEFAULT, () => setErrorRuntimeId(currentRuntime?.id)]
            )
          },
          disabled: busy || !canCompute,
          messageChildren: [span('View'),
            span('Error')],
          tooltip: canCompute ? 'View error' : noCompute
        })
      default:
        return defaultIcon(toolLabel)
    }
  }

  //TODO: build component around this logic for a multiple runtime approach. see getCostForTool for example usage
  const getRuntimeForTool = toolLabel => Utils.cond([toolLabel === currentRuntimeTool, () => currentRuntime],
    [Utils.DEFAULT, () => undefined])

  const getToolIcon = toolLabel => Utils.switchCase(toolLabel,
    [tools.Jupyter.label, () => jupyterLogo],
    [tools.galaxy.label, () => galaxyLogo],
    [tools.RStudio.label, () => rstudioLogo])

  //TODO this is a good example of how the code should look when multiple runtimes are allowed, over a tool-centric approach
  const getCostForTool = toolLabel => Utils.cond(
    [toolLabel === tools.galaxy.label, () => getGalaxyCostTextChildren(currentApp, galaxyDataDisks)],
    [getRuntimeForTool(toolLabel), () => {
      const runtime = getRuntimeForTool(toolLabel)
      const runtimeDisk = _.find({ id: runtime.runtimeConfig.persistentDiskId }, persistentDisks)
      const totalCost = runtimeCost(runtime) + runtimeDisk ? persistentDiskCost(runtimeDisk) : 0
      return span([`${runtime.status} (${formatUSD(totalCost)} / hr)`])
    }],
    [Utils.DEFAULT, () => span(['None'])]
  )

  const isCloudEnvModalDisabled = toolLabel => {
    if (toolLabel == tools.Jupyter.label) {
      console.log('runtimeforTool')
      console.log(getRuntimeForTool(toolLabel))
      console.log('isbusy')
      console.log(getIsRuntimeBusy(getRuntimeForTool(toolLabel)))
    }
    return Utils.cond(
      [toolLabel === tools.galaxy.label, () => !canCompute || busy || isCurrentGalaxyDiskDetaching(apps) || getIsAppBusy(currentApp)],
      [Utils.DEFAULT, () => {
        const runtime = getRuntimeForTool(toolLabel)
        return runtime ?
          !canCompute || busy || getIsRuntimeBusy(runtime) :
          !canCompute || busy || getIsRuntimeBusy(currentRuntime) //TODO:multiple runtimes: change this to not have the last check in the or
      }]
    )
  }

  // const isAppBusy =

  const getToolLaunchClickableProps = toolLabel => {
    const doesCloudEnvForToolExist = currentRuntimeTool === toolLabel || (currentApp && toolLabel === tools.galaxy.label)
    //TODO what does cookieReady do? Found it in the galaxy app launch code, is it needed here?
    const isDisabled = !doesCloudEnvForToolExist || !cookieReady
    const baseProps = {
      'aria-label': `Launch ${toolLabel}`,
      disabled: isDisabled,
      style: {
        ...toolButtonStyles,
        color: isDisabled ? colors.dark(0.7) : colors.accent()
      },
      hover: { backgroundColor: colors.accent(0.2) },
      tooltip: doesCloudEnvForToolExist ? 'Launch' : 'No environment found',
      tooltipDelay: 100
    }

    return Utils.switchCase(toolLabel,
      [tools.galaxy.label, () => {
        return {
          ...baseProps,
          href: currentApp?.proxyUrls.galaxy,
          onClick: () => {
            onDismiss()
            Ajax().Metrics.captureEvent(Events.applicationLaunch, { app: 'Galaxy' })
          },
          ...Utils.newTabLinkPropsWithReferrer
        }
      }], [Utils.DEFAULT, () => {
        return {
          ...baseProps,
          href: toolLabel === tools.Jupyter.label ? '' : '', //TODO: link
          onClick: () => {
            onDismiss()
            //TODO: metrics?
          }
        }
      }]
    )
  }


  const renderToolButtons = toolLabel => {
    const doesCloudEnvForToolExist = currentRuntimeTool === toolLabel || (currentApp && toolLabel === tools.galaxy.label)
    return h(Fragment, [
      div({ style: toolPanelStyles }, [
        //Label at the top for eacht ool
        div({ style: toolLabelStyles }, [
          img({
            src: getToolIcon(toolLabel),
            style: { height: 20 }
          }),
          getCostForTool(toolLabel)
        ]),
        // Cloud environment button
        div({ style: toolButtonDivStyles }, [
          h(Clickable, {
            'aria-label': `${toolLabel} Env`,
            style: {
              ...toolButtonStyles,
              color: !isCloudEnvModalDisabled(toolLabel) ? colors.accent() : colors.dark(0.7)
            },
            hover: { backgroundColor: colors.accent(0.2) },
            tooltip: Utils.cond([isCloudEnvModalDisabled(toolLabel), () => 'Edit disabled, processing'],
              [doesCloudEnvForToolExist, () => 'Edit existing environment'],
              [!doesCloudEnvForToolExist, () => 'Create new environment (may overwrite existing)']),
            disabled: isCloudEnvModalDisabled(toolLabel),
            tooltipDelay: 100,
            onClick: () => setViewMode(toolLabel)
          }, [
            icon('cloudBolt', { size: 20 }),
            span('Cloud'),
            span('Environment')
          ]),
          // Status button with stop/start functionality
          renderStatusClickable(toolLabel),
          // Launch button
          h(Clickable, { ...getToolLaunchClickableProps(toolLabel) }, [
            icon('rocket', { size: 20 }),
            span('Launch'),
            span(toolLabel)
          ])
        ])
      ])
    ])
  }

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
    viewMode !== undefined && hr({ style: { borderTop: '1px solid', width: '100%', color: colors.accent() } }),
    getView(),
    errorAppId && h(AppErrorModal, {
      app: _.find({ appName: errorAppId }, apps),
      onDismiss: () => setErrorAppId(undefined)
    }),
    errorRuntimeId && h(RuntimeErrorModal, {
      runtime: _.find({ id: errorRuntimeId }, runtimes),
      onDismiss: () => setErrorRuntimeId(undefined)
    }),
    busy && spinnerOverlay
  ])

  const modalProps = {
    'aria-labelledby': titleId, isOpen, width,
    onDismiss: () => {
      setViewMode(undefined)
      onDismiss()
    }
  }

  return h(ModalDrawer, { ...modalProps, children: modalBody })
}
