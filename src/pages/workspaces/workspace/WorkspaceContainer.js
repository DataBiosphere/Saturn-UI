import { differenceInSeconds, parseJSON } from 'date-fns/fp'
import _ from 'lodash/fp'
import { Fragment, useRef, useState } from 'react'
import { br, div, h, h2, p, span } from 'react-hyperscript-helpers'
import { ButtonPrimary, Clickable, comingSoon, Link, spinnerOverlay } from 'src/components/common'
import { ContextBar } from 'src/components/ContextBar'
import FooterWrapper from 'src/components/FooterWrapper'
import { icon } from 'src/components/icons'
import NewWorkspaceModal from 'src/components/NewWorkspaceModal'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import RuntimeManager from 'src/components/RuntimeManager'
import { TabBar } from 'src/components/tabBars'
import TopBar from 'src/components/TopBar'
import { Ajax, saToken } from 'src/libs/ajax'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { isAnalysisTabVisible, isTerra } from 'src/libs/config'
import { withErrorIgnoring, withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { clearNotification, notify } from 'src/libs/notifications'
import { getConvertedRuntimeStatus, getCurrentApp, getCurrentRuntime } from 'src/libs/runtime-utils'
import { workspaceStore } from 'src/libs/state'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import DeleteWorkspaceModal from 'src/pages/workspaces/workspace/DeleteWorkspaceModal'
import ShareWorkspaceModal from 'src/pages/workspaces/workspace/ShareWorkspaceModal'


const navIconProps = {
  style: { opacity: 0.65, marginRight: '1rem' },
  hover: { opacity: 1 }, focus: 'hover'
}

const WorkspaceTabs = ({
  namespace, name, workspace, activeTab, refresh,
  deletingWorkspace, setDeletingWorkspace, cloningWorkspace, setCloningWorkspace,
  sharingWorkspace, setSharingWorkspace
}) => {
  const isOwner = workspace && Utils.isOwner(workspace.accessLevel)
  const canShare = workspace?.canShare

  const tabs = [
    { name: 'dashboard', link: 'workspace-dashboard' },
    { name: 'data', link: 'workspace-data' },
    { name: 'notebooks', link: 'workspace-notebooks' },
    // the spread operator results in no array entry if the config value is false
    // we want this feature gated until it is ready for release
    ...(isAnalysisTabVisible() ? [{ name: 'analyses', link: 'workspace-analyses' }] : []),
    { name: 'workflows', link: 'workspace-workflows' },
    { name: 'job history', link: 'workspace-job-history' }
  ]
  return h(Fragment, [
    h(TabBar, {
      'aria-label': 'workspace menu',
      activeTab, refresh,
      tabNames: _.map('name', tabs),
      getHref: currentTab => Nav.getLink(_.find({ name: currentTab }, tabs).link, { namespace, name })
    }, [
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
        h(Clickable, { 'aria-label': 'Workspace menu', ...navIconProps }, [icon('cardMenuIcon', { size: 27 })])
      ])
    ]),
    deletingWorkspace && h(DeleteWorkspaceModal, {
      workspace,
      onDismiss: () => setDeletingWorkspace(false),
      onSuccess: () => Nav.goToPath('workspaces')
    }),
    cloningWorkspace && h(NewWorkspaceModal, {
      cloneWorkspace: workspace,
      onDismiss: () => setCloningWorkspace(false),
      onSuccess: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name })
    }),
    sharingWorkspace && h(ShareWorkspaceModal, {
      workspace,
      onDismiss: () => setSharingWorkspace(false)
    })
  ])
}

const WorkspaceContainer = ({ namespace, name, breadcrumbs, topBarContent, title, activeTab, showTabBar = true, refresh, refreshRuntimes, workspace, runtimes, persistentDisks, galaxyDataDisks, apps, refreshApps, children }) => {
  const [deletingWorkspace, setDeletingWorkspace] = useState(false)
  const [cloningWorkspace, setCloningWorkspace] = useState(false)
  const [sharingWorkspace, setSharingWorkspace] = useState(false)
  const isOwner = workspace && Utils.isOwner(workspace.accessLevel)
  const canShare = !!workspace?.canShare

  return h(FooterWrapper, [
    h(TopBar, { title: 'Workspaces', href: Nav.getLink('workspaces') }, [
      div({ style: Style.breadcrumb.breadcrumb }, [
        div({ style: Style.noWrapEllipsis }, breadcrumbs),
        h2({ style: Style.breadcrumb.textUnderBreadcrumb }, [
          title || `${namespace}/${name}`,
          workspace && !Utils.canWrite(workspace.accessLevel) && span({ style: { paddingLeft: '0.5rem', color: colors.dark(0.85) } }, '(read only)')
        ])
      ]),
      topBarContent,
      div({ style: { flexGrow: 1 } }),
      isTerra() && h(Link, {
        href: 'https://support.terra.bio/hc/en-us/articles/360041068771--COVID-19-workspaces-data-and-tools-in-Terra',
        style: {
          backgroundColor: colors.light(), borderRadius: 4,
          marginRight: '1.5rem', marginLeft: '0.5rem', padding: '0.4rem 0.8rem',
          display: 'flex', alignItems: 'center', flexShrink: 0
        },
        ...Utils.newTabLinkProps
      }, [
        icon('virus', { size: 24, style: { marginRight: '0.5rem' } }),
        div({ style: { fontSize: 12, color: colors.dark() } }, ['COVID-19', br(), 'Data & Tools'])
      ]),
      h(RuntimeManager, {
        namespace, name, runtimes, persistentDisks, refreshRuntimes,
        canCompute: !!(workspace?.canCompute || runtimes?.length),
        apps, galaxyDataDisks, workspace, refreshApps
      })
    ]),
    showTabBar && h(WorkspaceTabs, { namespace, name, activeTab, refresh, workspace, deletingWorkspace, setDeletingWorkspace, cloningWorkspace, setCloningWorkspace, sharingWorkspace, setSharingWorkspace }),
    div({ role: 'main', style: Style.elements.pageContentContainer },
      // Display the context bar only if the analysis tab is visible, for now
      (isAnalysisTabVisible() && activeTab === 'analyses' ?
        [div({ style: { flex: 1, display: 'flex' } }, [
          div({ style: { flex: 1 } }, [
            children
          ]),
          workspace && h(ContextBar, {
            setDeletingWorkspace,
            setCloningWorkspace,
            setSharingWorkspace,
            isOwner,
            canShare,
            canCompute: !!(workspace?.canCompute || runtimes?.length),
            workspace, refreshApps, refreshRuntimes,
            runtimes, persistentDisks, galaxyDataDisks, apps
          })
        ])] : [children]))
  ])
}


const WorkspaceAccessError = () => {
  const groupURL = 'https://software.broadinstitute.org/firecloud/documentation/article?id=9553'
  const authorizationURL = 'https://software.broadinstitute.org/firecloud/documentation/article?id=9524'
  return div({ style: { padding: '2rem', flexGrow: 1 } }, [
    h2(['Could not display workspace']),
    p(['You are trying to access a workspace that either does not exist, or you do not have access to it.']),
    p([
      'You are currently logged in as ',
      span({ style: { fontWeight: 600 } }, [getUser().email]),
      '. You may have access with a different account.'
    ]),
    p([
      'To view an existing workspace, the owner of the workspace must share it with you or with a ',
      h(Link, { ...Utils.newTabLinkProps, href: groupURL }, 'Group'), ' of which you are a member. ',
      'If the workspace is protected under an ', h(Link, { ...Utils.newTabLinkProps, href: authorizationURL }, 'Authorization Domain'),
      ', you must be a member of every group within the Authorization Domain.'
    ]),
    p(['If you think the workspace exists but you do not have access, please contact the workspace owner.']),
    h(ButtonPrimary, {
      href: Nav.getLink('workspaces')
    }, ['Return to Workspace List'])
  ])
}

const useCloudEnvironmentPolling = namespace => {
  const signal = Utils.useCancellation()
  const timeout = useRef()
  const [runtimes, setRuntimes] = useState()
  const [persistentDisks, setPersistentDisks] = useState()
  const [galaxyDataDisks, setGalaxyDataDisks] = useState()

  const reschedule = ms => {
    clearTimeout(timeout.current)
    timeout.current = setTimeout(refreshRuntimesSilently, ms)
  }
  const load = async maybeStale => {
    try {
      const [newDisks, newRuntimes, galaxyDisks] = await Promise.all([
        Ajax(signal).Disks.list({ googleProject: namespace, creator: getUser().email }),
        Ajax(signal).Runtimes.list({ googleProject: namespace, creator: getUser().email }),
        Ajax(signal).Disks.list({ googleProject: namespace, creator: getUser().email, saturnApplication: 'galaxy' })
      ])
      const galaxyDiskNames = _.map(disk => disk.name, galaxyDisks)
      setRuntimes(newRuntimes)
      setGalaxyDataDisks(galaxyDisks)
      setPersistentDisks(_.remove(disk => _.includes(disk.name, galaxyDiskNames), newDisks))

      const runtime = getCurrentRuntime(newRuntimes)
      reschedule(maybeStale || _.includes(getConvertedRuntimeStatus(runtime), ['Creating', 'Starting', 'Stopping', 'Updating', 'LeoReconfiguring']) ? 10000 : 120000)
    } catch (error) {
      reschedule(30000)
      throw error
    }
  }
  const refreshRuntimes = withErrorReporting('Error loading cloud environments', load)
  const refreshRuntimesSilently = withErrorIgnoring(load)
  Utils.useOnMount(() => {
    refreshRuntimes()
    return () => clearTimeout(timeout.current)
  })
  return { runtimes, refreshRuntimes, persistentDisks, galaxyDataDisks }
}

const useAppPolling = (namespace, name) => {
  const signal = Utils.useCancellation()
  const timeout = useRef()
  const [apps, setApps] = useState()
  const reschedule = ms => {
    clearTimeout(timeout.current)
    timeout.current = setTimeout(refreshAppsSilently, ms)
  }
  const loadApps = async () => {
    try {
      const newApps = await Ajax(signal).Apps.list(namespace, { creator: getUser().email, saturnWorkspaceName: name })
      setApps(newApps)
      const app = getCurrentApp(newApps)
      reschedule((app && _.includes(app.status, ['PROVISIONING', 'PREDELETING'])) ? 10000 : 120000)
    } catch (error) {
      reschedule(30000)
      throw error
    }
  }
  const refreshApps = withErrorReporting('Error loading apps', loadApps)
  const refreshAppsSilently = withErrorIgnoring(loadApps)
  Utils.useOnMount(() => {
    refreshApps()
    return () => clearTimeout(timeout.current)
  })
  return { apps, refreshApps }
}

export const wrapWorkspace = ({ breadcrumbs, activeTab, title, topBarContent, showTabBar = true, queryparams }) => WrappedComponent => {
  const Wrapper = props => {
    const { namespace, name } = props
    const child = useRef()
    const signal = Utils.useCancellation()
    const [accessError, setAccessError] = useState(false)
    const accessNotificationId = useRef()
    const cachedWorkspace = Utils.useStore(workspaceStore)
    const [loadingWorkspace, setLoadingWorkspace] = useState(false)
    const { runtimes, refreshRuntimes, persistentDisks, galaxyDataDisks } = useCloudEnvironmentPolling(namespace)
    const { apps, refreshApps } = useAppPolling(namespace, name)
    const workspace = cachedWorkspace && _.isEqual({ namespace, name }, _.pick(['namespace', 'name'], cachedWorkspace.workspace)) ?
      cachedWorkspace :
      undefined

    const refreshWorkspace = _.flow(
      withErrorReporting('Error loading workspace'),
      Utils.withBusyState(setLoadingWorkspace)
    )(async () => {
      try {
        const workspace = await Ajax(signal).Workspaces.workspace(namespace, name).details([
          'accessLevel', 'canCompute', 'canShare', 'owners',
          'workspace', 'workspace.attributes', 'workspace.authorizationDomain',
          'workspaceSubmissionStats'
        ])
        workspaceStore.set(workspace)

        const { accessLevel, workspace: { createdBy, createdDate } } = workspace

        // Request a service account token. If this is the first time, it could take some time before everything is in sync.
        // Doing this now, even though we don't explicitly need it now, increases the likelihood that it will be ready when it is needed.
        if (Utils.canWrite(accessLevel)) {
          saToken(namespace)
        }

        if (!Utils.isOwner(accessLevel) && (createdBy === getUser().email) && (differenceInSeconds(Date.now(), parseJSON(createdDate)) < 60)) {
          accessNotificationId.current = notify('info', 'Workspace access synchronizing', {
            message: h(Fragment, [
              'It looks like you just created this workspace. It may take up to a minute before you have access to modify it. Refresh at any time to re-check.',
              div({ style: { marginTop: '1rem' } }, [h(Link, {
                onClick: () => {
                  refreshWorkspace()
                  clearNotification(accessNotificationId.current)
                }
              }, 'Click to refresh now')])
            ])
          })
        }
      } catch (error) {
        if (error.status === 404) {
          setAccessError(true)
        } else {
          throw error
        }
      }
    })

    Utils.useOnMount(() => {
      if (!workspace) {
        refreshWorkspace()
      }
    })

    if (accessError) {
      return h(FooterWrapper, [h(TopBar), h(WorkspaceAccessError)])
    } else {
      return h(WorkspaceContainer, {
        namespace, name, activeTab, showTabBar, workspace, runtimes, persistentDisks, galaxyDataDisks, apps, refreshApps,
        title: _.isFunction(title) ? title(props) : title,
        breadcrumbs: breadcrumbs(props),
        topBarContent: topBarContent && topBarContent({ workspace, ...props }),
        refresh: async () => {
          await refreshWorkspace()
          if (child.current?.refresh) {
            child.current.refresh()
          }
        },
        refreshRuntimes
      }, [
        workspace && h(WrappedComponent, {
          ref: child,
          workspace, refreshWorkspace, refreshApps, refreshRuntimes,
          runtimes, persistentDisks, galaxyDataDisks, apps,
          ...props
        }),
        loadingWorkspace && spinnerOverlay
      ])
    }
  }
  return Utils.withDisplayName('wrapWorkspace', Wrapper)
}
