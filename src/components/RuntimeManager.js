import { isToday } from 'date-fns'
import { isAfter } from 'date-fns/fp'
import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Fragment, PureComponent, useState } from 'react'
import { div, h, img, p, span } from 'react-hyperscript-helpers'
import { ButtonPrimary, Clickable, IdContainer, Link, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { NewGalaxyModal } from 'src/components/NewGalaxyModal'
import { NewRuntimeModal } from 'src/components/NewRuntimeModal'
import { CloudComputeModal } from 'src/components/CloudComputeModal'
import { GalaxyLaunchButton, GalaxyWarning } from 'src/components/runtime-common'
import { dataSyncingDocUrl } from 'src/data/machines'
import galaxyLogo from 'src/images/galaxy.svg'
import rLogo from 'src/images/r-logo.svg'
import { Ajax } from 'src/libs/ajax'
import { getDynamic, setDynamic } from 'src/libs/browser-storage'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { clearNotification, notify } from 'src/libs/notifications'
import {
  appIsSettingUp,
  collapsedRuntimeStatus,
  convertedAppStatus,
  currentApp,
  currentRuntime,
  persistentDiskCost,
  runtimeCost,
  trimRuntimesOldestFirst
} from 'src/libs/runtime-utils'
import { errorNotifiedApps, errorNotifiedRuntimes } from 'src/libs/state'
import * as Utils from 'src/libs/utils'


const noCompute = 'You do not have access to run analyses on this workspace.'

const styles = {
  verticalCenter: { display: 'flex', alignItems: 'center' },
  container: {
    height: '3rem',
    display: 'flex', alignItems: 'center', flex: 'none',
    paddingLeft: '1rem', paddingRight: '1rem',
    borderTopLeftRadius: 5, borderBottomLeftRadius: 5,
    backgroundColor: colors.light()
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '1rem'
  },
  button: isDisabled => ({
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: isDisabled ? 'not-allowed' : 'pointer'
  })
}

const RuntimeIcon = ({ shape, onClick, disabled, style, ...props }) => {
  return h(Clickable, {
    style: { color: onClick && !disabled ? colors.accent() : colors.dark(0.7), ...styles.verticalCenter, ...style },
    onClick, disabled, ...props
  }, [icon(shape, { size: 20 })])
}

export const RuntimeErrorModal = ({ runtime, onDismiss }) => {
  const [error, setError] = useState()
  const [userscriptError, setUserscriptError] = useState(false)
  const [loadingRuntimeDetails, setLoadingRuntimeDetails] = useState(false)

  const loadRuntimeError = _.flow(
    withErrorReporting('Error loading cloud environment details'),
    Utils.withBusyState(setLoadingRuntimeDetails)
  )(async () => {
    const { errors: runtimeErrors } = await Ajax().Runtimes.runtime(runtime.googleProject, runtime.runtimeName).details()
    if (_.some(({ errorMessage }) => errorMessage.includes('Userscript failed'), runtimeErrors)) {
      setError(
        await Ajax()
          .Buckets
          .getObjectPreview(runtime.asyncRuntimeFields.stagingBucket, `userscript_output.txt`, runtime.googleProject, true)
          .then(res => res.text()))
      setUserscriptError(true)
    } else {
      setError(runtimeErrors[0].errorMessage)
    }
  })

  Utils.useOnMount(() => { loadRuntimeError() })

  return h(Modal, {
    title: `Cloud Environment Creation Failed${userscriptError ? ' due to Userscript Error' : ''}`,
    showCancel: false,
    onDismiss
  }, [
    div({ style: { whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflowY: 'auto', maxHeight: 500, background: colors.light() } }, [error]),
    loadingRuntimeDetails && spinnerOverlay
  ])
}

const RuntimeErrorNotification = ({ runtime }) => {
  const [modalOpen, setModalOpen] = useState(false)

  return h(Fragment, [
    h(Clickable, {
      onClick: () => setModalOpen(true),
      style: {
        marginTop: '1rem',
        textDecoration: 'underline',
        fontWeight: 'bold'
      }
    }, ['SEE LOG INFO']),
    modalOpen && h(RuntimeErrorModal, {
      runtime,
      onDismiss: () => setModalOpen(false)
    })
  ])
}

export const AppErrorModal = ({ app, onDismiss }) => {
  const [error, setError] = useState()
  const [loadingAppDetails, setLoadingAppDetails] = useState(false)

  const loadAppError = _.flow(
    withErrorReporting('Error loading app details'),
    Utils.withBusyState(setLoadingAppDetails)
  )(async () => {
    const { errors: appErrors } = await Ajax().Apps.app(app.googleProject, app.appName).details()
    setError(appErrors[0]?.errorMessage)
  })

  Utils.useOnMount(() => { loadAppError() })

  return h(Modal, {
    title: `Galaxy App Creation Failed`,
    showCancel: false,
    onDismiss
  }, [
    div({ style: { whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflowY: 'auto', maxHeight: 500, background: colors.light() } }, [error]),
    loadingAppDetails && spinnerOverlay
  ])
}


const AppErrorNotification = ({ app }) => {
  const [modalOpen, setModalOpen] = useState(false)

  return h(Fragment, [
    h(Clickable, {
      onClick: () => setModalOpen(true),
      style: {
        marginTop: '1rem',
        textDecoration: 'underline',
        fontWeight: 'bold'
      }
    }, ['SEE LOG INFO']),
    modalOpen && h(AppErrorModal, {
      app,
      onDismiss: () => setModalOpen(false)
    })
  ])
}

export default class RuntimeManager extends PureComponent {
  static propTypes = {
    namespace: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    runtimes: PropTypes.array,
    persistentDisks: PropTypes.array,
    canCompute: PropTypes.bool.isRequired,
    refreshRuntimes: PropTypes.func.isRequired,
    workspace: PropTypes.object,
    apps: PropTypes.array,
    galaxyDataDisks: PropTypes.array
  }

  constructor(props) {
    super(props)
    this.state = {
      createModalDrawerOpen: false,
      busy: false,
      galaxyDrawerOpen: false
    }
  }

  componentDidUpdate(prevProps) {
    const { namespace, name, apps } = this.props
    const prevRuntime = _.last(_.sortBy('auditInfo.createdDate', _.remove({ status: 'Deleting' }, prevProps.runtimes))) || {}
    const runtime = this.getCurrentRuntime() || {}
    const twoMonthsAgo = _.tap(d => d.setMonth(d.getMonth() - 2), new Date())
    const welderCutOff = new Date('2019-08-01')
    const createdDate = new Date(runtime.createdDate)
    const dateNotified = getDynamic(sessionStorage, `notifiedOutdatedRuntime${runtime.id}`) || {}
    const rStudioLaunchLink = Nav.getLink('workspace-application-launch', { namespace, name, application: 'RStudio' })
    const app = currentApp(apps)
    const prevApp = currentApp(prevProps.apps)

    if (runtime.status === 'Error' && prevRuntime.status !== 'Error' && !_.includes(runtime.id, errorNotifiedRuntimes.get())) {
      notify('error', 'Error Creating Cloud Environment', {
        message: h(RuntimeErrorNotification, { runtime })
      })
      errorNotifiedRuntimes.update(Utils.append(runtime.id))
    } else if (
      runtime.status === 'Running' && prevRuntime.status && prevRuntime.status !== 'Running' &&
      runtime.labels.tool === 'RStudio' && window.location.hash !== rStudioLaunchLink
    ) {
      const rStudioNotificationId = notify('info', 'Your cloud environment is ready.', {
        message: h(ButtonPrimary, {
          href: rStudioLaunchLink,
          onClick: () => clearNotification(rStudioNotificationId)
        }, 'Launch Cloud Environment')
      })
    } else if (isAfter(createdDate, welderCutOff) && !isToday(dateNotified)) { // TODO: remove this notification some time after the data syncing release
      setDynamic(sessionStorage, `notifiedOutdatedRuntime${runtime.id}`, Date.now())
      notify('warn', 'Please Update Your Cloud Environment', {
        message: h(Fragment, [
          p(['Last year, we introduced important updates to Terra that are not compatible with the older cloud environment associated with this workspace. You are no longer able to save new changes to notebooks using this older cloud environment.']),
          h(Link, { href: dataSyncingDocUrl, ...Utils.newTabLinkProps }, ['Read here for more details.'])
        ])
      })
    } else if (isAfter(createdDate, twoMonthsAgo) && !isToday(dateNotified)) {
      setDynamic(sessionStorage, `notifiedOutdatedRuntime${runtime.id}`, Date.now())
      notify('warn', 'Outdated Cloud Environment', {
        message: 'Your cloud environment is over two months old. Please consider deleting and recreating your cloud environment in order to access the latest features and security updates.'
      })
    } else if (runtime.status === 'Running' && prevRuntime.status === 'Updating') {
      notify('success', 'Number of workers has updated successfully.')
    }
    if (prevApp && prevApp.status !== 'RUNNING' && app?.status === 'RUNNING') {
      const galaxyId = notify('info', 'Your cloud environment for Galaxy is ready.', {
        message: h(Fragment, [
          h(GalaxyWarning),
          h(GalaxyLaunchButton, {
            app,
            onClick: () => clearNotification(galaxyId)
          })
        ])
      })
    } else if (app?.status === 'ERROR' && !_.includes(app.appName, errorNotifiedApps.get())) {
      notify('error', 'Error Creating Galaxy App', {
        message: h(AppErrorNotification, { app })
      })
      errorNotifiedApps.update(Utils.append(app.appName))
    }
  }

  getActiveRuntimesOldestFirst() {
    const { runtimes } = this.props
    return trimRuntimesOldestFirst(runtimes)
  }

  getCurrentRuntime() {
    const { runtimes } = this.props
    return currentRuntime(runtimes)
  }

  async executeAndRefresh(promise) {
    try {
      const { refreshRuntimes } = this.props
      this.setState({ busy: true })
      await promise
      await refreshRuntimes()
    } catch (error) {
      reportError('Cloud Environment Error', error)
    } finally {
      this.setState({ busy: false })
    }
  }

  startRuntime() {
    const { googleProject, runtimeName } = this.getCurrentRuntime()
    this.executeAndRefresh(
      Ajax().Runtimes.runtime(googleProject, runtimeName).start()
    )
  }

  stopRuntime() {
    const { googleProject, runtimeName } = this.getCurrentRuntime()
    this.executeAndRefresh(
      Ajax().Runtimes.runtime(googleProject, runtimeName).stop()
    )
  }

  render() {
    const { namespace, name, runtimes, refreshRuntimes, canCompute, persistentDisks, apps, galaxyDataDisks, refreshApps, workspace } = this.props
    const { busy, createModalDrawerOpen, errorModalOpen, galaxyDrawerOpen } = this.state
    if (!runtimes || !apps) {
      return null
    }
    const currentRuntime = this.getCurrentRuntime()
    const currentStatus = collapsedRuntimeStatus(currentRuntime)

    const renderIcon = () => {
      switch (currentStatus) {
        case 'Stopped':
          return h(RuntimeIcon, {
            shape: 'play',
            onClick: () => this.startRuntime(),
            disabled: busy || !canCompute,
            tooltip: canCompute ? 'Start cloud environment' : noCompute
          })
        case 'Running':
          return h(RuntimeIcon, {
            shape: 'pause',
            onClick: () => this.stopRuntime(),
            disabled: busy || !canCompute,
            tooltip: canCompute ? 'Stop cloud environment' : noCompute
          })
        case 'Starting':
        case 'Stopping':
        case 'Updating':
        case 'Creating':
        case 'LeoReconfiguring':
          return h(RuntimeIcon, {
            shape: 'sync',
            disabled: true,
            tooltip: 'Cloud environment update in progress'
          })
        case 'Error':
          return h(RuntimeIcon, {
            shape: 'warning-standard',
            style: { color: colors.danger(0.9) },
            onClick: () => this.setState({ errorModalOpen: true }),
            disabled: busy || !canCompute,
            tooltip: canCompute ? 'View error' : noCompute
          })
        default:
          return h(RuntimeIcon, {
            shape: 'play',
            onClick: () => this.setState({ createModalDrawerOpen: true }),
            disabled: busy || !canCompute,
            tooltip: canCompute ? 'Create cloud environment' : noCompute
          })
      }
    }
    const totalCost = _.sum(_.map(runtimeCost, runtimes)) + _.sum(_.map(persistentDiskCost, persistentDisks))
    const activeRuntimes = this.getActiveRuntimesOldestFirst()
    const activeDisks = _.remove({ status: 'Deleting' }, persistentDisks)
    const { Creating: creating, Updating: updating, LeoReconfiguring: reconfiguring } = _.countBy(collapsedRuntimeStatus, activeRuntimes)
    const isDisabled = !canCompute || creating || busy || updating || reconfiguring

    const isRStudioImage = currentRuntime?.labels.tool === 'RStudio'
    const applicationName = isRStudioImage ? 'RStudio' : 'terminal'
    const applicationLaunchLink = Nav.getLink('workspace-application-launch', { namespace, name, application: applicationName })

    const app = currentApp(apps)

    return h(Fragment, [
      app && div({ style: { ...styles.container, borderRadius: 5, marginRight: '1.5rem' } }, [
        h(Clickable, {
          style: { display: 'flex' },
          disabled: appIsSettingUp(app),
          tooltip: appIsSettingUp(app) ?
            'Galaxy app is being created' :
            'View cloud environment',
          onClick: () => {
            this.setState({ galaxyDrawerOpen: true })
          }
        }, [
          img({ src: galaxyLogo, alt: '', style: { marginRight: '0.25rem' } }),
          div([
            div({ style: { fontSize: 12, fontWeight: 'bold' } }, ['Galaxy']),
            div({ style: { fontSize: 10 } }, [convertedAppStatus(app.status)])
          ])
        ])
      ]),
      div({ style: styles.container }, [
        (activeRuntimes.length > 1 || activeDisks.length > 1) && h(Link, {
          style: { marginRight: '1rem' },
          href: Nav.getLink('environments'),
          tooltip: 'Multiple cloud environments found in this billing project. Click to select which to delete.'
        }, [icon('warning-standard', { size: 24, style: { color: colors.danger() } })]),
        h(Link, {
          href: applicationLaunchLink,
          onClick: window.location.hash === applicationLaunchLink && currentStatus === 'Stopped' ? () => this.startRuntime() : undefined,
          tooltip: canCompute ? `Open ${applicationName}` : noCompute,
          disabled: !canCompute,
          style: { marginRight: '2rem', ...styles.verticalCenter },
          ...(isRStudioImage ? {} : Utils.newTabLinkProps)
        }, [isRStudioImage ? img({ src: rLogo, alt: '', style: { maxWidth: 24, maxHeight: 24 } }) : icon('terminal', { size: 24 })]),
        renderIcon(),
        h(IdContainer, [id => h(Fragment, [
          h(Clickable, {
            id,
            style: styles.button(isDisabled),
            tooltip: Utils.cond(
              [!canCompute, () => noCompute],
              [creating, () => 'Your environment is being created'],
              () => 'Update cloud environment'
            ),
            onClick: () => this.setState({ createModalDrawerOpen: true }),
            disabled: isDisabled
          }, [
            div({ style: { marginLeft: '0.5rem', paddingRight: '0.5rem', color: colors.dark() } }, [
              div({ style: { fontSize: 12, fontWeight: 'bold' } }, 'Cloud Environment'),
              div({ style: { fontSize: 10 } }, [
                span({ style: { textTransform: 'capitalize', fontWeight: 500 } },
                  [currentStatus === 'LeoReconfiguring' ? 'Updating' : (currentStatus || 'None')]),
                !!totalCost && ` (${Utils.formatUSD(totalCost)} / hr)`
              ])
            ]),
            icon('cog', { size: 22, style: { color: isDisabled ? colors.dark(0.7) : colors.accent() } })
          ])
        ])]),
        // h(NewRuntimeModal, {
        //   isOpen: createModalDrawerOpen,
        //   workspace,
        //   runtimes,
        //   persistentDisks,
        //   onDismiss: () => this.setState({ createModalDrawerOpen: false }),
        //   onSuccess: _.flow(
        //     withErrorReporting('Error loading cloud environment'),
        //     Utils.withBusyState(v => this.setState({ busy: v }))
        //   )(async () => {
        //     this.setState({ createModalDrawerOpen: false })
        //     await refreshRuntimes(true)
        //   })
        // }),
        h(CloudComputeModal, {
          isOpen: createModalDrawerOpen,
          workspace,
          runtimes,
          persistentDisks,
          onDismiss: () => this.setState({ createModalDrawerOpen: false }),
          onSuccess: _.flow(
            withErrorReporting('Error loading cloud environment'),
            Utils.withBusyState(v => this.setState({ busy: v }))
          )(async () => {
            this.setState({ createModalDrawerOpen: false })
            await refreshRuntimes(true)
          })
        }),
        h(NewGalaxyModal, {
          workspace,
          apps,
          galaxyDataDisks,
          isOpen: galaxyDrawerOpen,
          onDismiss: () => this.setState({ galaxyDrawerOpen: false }),
          onSuccess: () => {
            withErrorReporting('Error loading galaxy environment')(
              this.setState({ galaxyDrawerOpen: false }),
              refreshApps()
            )
          }
        }),
        errorModalOpen && h(RuntimeErrorModal, {
          runtime: currentRuntime,
          onDismiss: () => this.setState({ errorModalOpen: false })
        })
      ])
    ])
  }
}
