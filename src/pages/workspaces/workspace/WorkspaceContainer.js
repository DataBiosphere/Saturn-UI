import _ from 'lodash/fp'
import { createRef, Fragment, PureComponent } from 'react'
import { a, div, h, h2, p } from 'react-hyperscript-helpers'
import ClusterManager from 'src/components/ClusterManager'
import { buttonPrimary, Clickable, comingSoon, contextBar, link, MenuButton, spinnerOverlay } from 'src/components/common'
import ErrorView from 'src/components/ErrorView'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import NewWorkspaceModal from 'src/components/NewWorkspaceModal'
import PopupTrigger from 'src/components/PopupTrigger'
import { TopBar } from 'src/components/TopBar'
import { Jupyter, Workspaces } from 'src/libs/ajax'
import { getBasicProfile } from 'src/libs/auth'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


const styles = {
  tabContainer: {
    paddingLeft: '5rem', borderBottom: `5px solid ${Style.colors.secondary}`,
    color: 'white', textTransform: 'uppercase'
  },
  tab: {
    maxWidth: 140, flexGrow: 1, color: Style.colors.textFadedLight,
    alignSelf: 'stretch', display: 'flex', justifyContent: 'center', alignItems: 'center'
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.15)', color: 'unset',
    borderBottom: `4px solid ${Style.colors.secondary}`
  }
}

const navSeparator = div({
  style: { background: 'rgba(255,255,255,0.15)', width: 1, height: '3rem', flexShrink: 0 }
})

const navIconProps = {
  style: { opacity: 0.65, marginRight: '1rem' },
  hover: { opacity: 1 }, focus: 'hover'
}


class WorkspaceTabs extends PureComponent {
  constructor(props) {
    super(props)
    this.menu = createRef()
  }

  render() {
    const { namespace, name, workspace, activeTab, refresh, onDelete, onClone } = this.props
    const navTab = ({ tabName, href }) => {
      const selected = tabName === activeTab
      return h(Fragment, [
        a({
          style: { ...styles.tab, ...(selected ? styles.activeTab : {}) },
          // some pages highlight a tab even when they're not on that url
          onClick: href === window.location.hash ? refresh : undefined,
          href
        }, tabName),
        navSeparator
      ])
    }
    const isOwner = workspace && _.includes(workspace.accessLevel, ['OWNER', 'PROJECT_OWNER'])
    return contextBar({ style: styles.tabContainer }, [
      navSeparator,
      navTab({ tabName: 'dashboard', href: Nav.getLink('workspace', { namespace, name }) }),
      navTab({ tabName: 'notebooks', href: Nav.getLink('workspace-notebooks', { namespace, name }) }),
      navTab({ tabName: 'data', href: Nav.getLink('workspace-data', { namespace, name }) }),
      navTab({ tabName: 'tools', href: Nav.getLink('workspace-tools', { namespace, name }) }),
      navTab({ tabName: 'job history', href: Nav.getLink('workspace-job-history', { namespace, name }) }),
      div({ style: { flexGrow: 1 } }),
      h(Clickable, {
        ...navIconProps,
        onClick: onClone
      }, [icon('copy', { size: 22 })]),
      h(PopupTrigger, {
        ref: this.menu,
        content: h(Fragment, [
          h(MenuButton, { disabled: true }, ['Share', comingSoon]),
          h(MenuButton, { disabled: true }, ['Publish', comingSoon]),
          h(MenuButton, {
            disabled: !isOwner,
            tooltip: !isOwner && 'You must be an owner of this workspace or the underlying billing project',
            tooltipSide: 'left',
            onClick: () => {
              onDelete()
              this.menu.current.close()
            }
          }, ['Delete'])
        ]),
        position: 'bottom'
      }, [
        h(Clickable, { ...navIconProps }, [icon('ellipsis-vertical', { size: 22 })])
      ])
    ])
  }
}


class DeleteWorkspaceModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      deleting: false,
      workspace: undefined
    }
  }

  async deleteWorkspace() {
    const { namespace, name } = this.props
    try {
      this.setState({ deleting: true })
      await Workspaces.workspace(namespace, name).delete()
      Nav.goToPath('workspaces')
    } catch (error) {
      reportError('Error deleting workspace', error)
      this.setState({ deleting: false })
    }
  }

  async componentDidMount() {
    const { namespace, name } = this.props
    try {
      const workspace = await Workspaces.workspace(namespace, name).details()
      this.setState({ workspace })
    } catch (error) {
      reportError('Error loading workspace', error)
    }
  }

  render() {
    const { onDismiss } = this.props
    const { workspace, deleting } = this.state
    return h(Modal, {
      title: 'Confirm delete',
      onDismiss,
      okButton: buttonPrimary({
        onClick: () => this.deleteWorkspace()
      }, 'Delete')
    }, [
      div(['Are you sure you want to permanently delete this workspace?']),
      div({ style: { marginTop: '1rem' } }, [
        'Deleting it will delete the associated ',
        link({
          target: '_blank',
          href: Utils.bucketBrowserUrl(workspace && workspace.workspace.bucketName)
        }, ['Google Cloud Bucket']),
        ' and all its data.'
      ]),
      deleting && spinnerOverlay
    ])
  }
}


class WorkspaceContainer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      deletingWorkspace: false,
      cloningWorkspace: false
    }
  }

  onDelete = () => {
    this.setState({ deletingWorkspace: true })
  }

  onClone = () => {
    this.setState({ cloningWorkspace: true })
  }

  render() {
    const { namespace, name, breadcrumbs, title, activeTab, refresh, refreshClusters, workspace, clusters } = this.props
    const { deletingWorkspace, cloningWorkspace } = this.state

    return div({ style: { display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 } }, [
      h(TopBar, { title: 'Workspaces' }, [
        div({ style: { display: 'flex', flexDirection: 'column', paddingLeft: '4rem' } }, [
          div({}, breadcrumbs),
          div({ style: { fontSize: '1.25rem' } }, [
            title || `${namespace}/${name}`
          ])
        ]),
        h(ClusterManager, {
          namespace, name, clusters, refreshClusters,
          canCompute: (workspace && workspace.canCompute) || (clusters && clusters.length)
        })
      ]),
      h(WorkspaceTabs, {
        namespace, name, activeTab, refresh, workspace,
        onDelete: this.onDelete, onClone: this.onClone
      }),
      div({ style: { position: 'relative', flexGrow: 1, display: 'flex', flexDirection: 'column' } }, [
        this.props.children
      ]),
      deletingWorkspace && h(DeleteWorkspaceModal, {
        namespace, name,
        onDismiss: () => this.setState({ deletingWorkspace: false })
      }),
      cloningWorkspace && h(NewWorkspaceModal, {
        cloneWorkspace: workspace,
        onDismiss: () => this.setState({ cloningWorkspace: false })
      })
    ])
  }
}


export const wrapWorkspace = ({ breadcrumbs, activeTab, title }, content) => {
  return class WorkspaceContainerWrapper extends Component {
    constructor(props) {
      super(props)
      this.child = createRef()
    }

    render() {
      const { workspaceError } = this.state

      return workspaceError ? this.renderError() : this.renderSuccess()
    }

    renderSuccess() {
      const { namespace, name } = this.props
      const { workspace, clusters } = this.state

      return h(WorkspaceContainer, {
        namespace, name, activeTab, workspace, clusters,
        title: _.isFunction(title) ? title(this.props) : title,
        breadcrumbs: breadcrumbs(this.props),
        refresh: async () => {
          await this.refresh()
          const child = this.child.current
          if (child.refresh) {
            child.refresh()
          }
        },
        refreshClusters: () => this.refreshClusters()
      }, [
        workspace && h(content, {
          ref: this.child,
          workspace, clusters, refreshClusters: () => this.refreshClusters(),
          ...this.props
        })
      ])
    }

    renderError() {
      const { workspaceError, errorText } = this.state

      return div({ style: { padding: '2rem' } }, [
        workspaceError.status === 404 ?
          h(Fragment, [
            h2({}, ['Could not display workspace.']),
            p({},
              ['Either the requested workspace does not exist, or you do not have access. If you suspect you do not have access, please contact the workspace owner.'])
          ]) :
          h(Fragment, [
            h2({}, ['Failed to load workspace']),
            h(ErrorView, { error: errorText })
          ])
      ])
    }

    componentDidMount() {
      this.refresh()
      this.refreshClusters()
    }

    async refreshClusters() {
      const { namespace } = this.props
      try {
        const clusters = _.filter({ googleProject: namespace, creator: getBasicProfile().getEmail() }, await Jupyter.clustersList())
        this.setState({ clusters })
      } catch (error) {
        reportError('Error loading clusters', error)
      }
    }

    async refresh() {
      const { namespace, name } = this.props
      try {
        const workspace = await Workspaces.workspace(namespace, name).details()
        this.setState({ workspace })
      } catch (error) {
        this.setState({ workspaceError: error, errorText: await error.text() })
      }
    }
  }
}
