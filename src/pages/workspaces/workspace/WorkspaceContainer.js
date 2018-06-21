import _ from 'lodash/fp'
import { Component, createRef, Fragment, PureComponent } from 'react'
import { a, div, h } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import ClusterManager from 'src/components/ClusterManager'
import { buttonPrimary, contextBar, contextMenu, link, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import PopupTrigger from 'src/components/PopupTrigger'
import { TopBar } from 'src/components/TopBar'
import { Rawls } from 'src/libs/ajax'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'

const bucketUrl = id => `https://console.cloud.google.com/storage/browser/${id}`

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
  menu = createRef()

  render() {
    const { namespace, name, workspace, activeTab, refresh, onDelete } = this.props
    const navTab = ({ tabName, href }) => {
      const selected = tabName === activeTab
      return h(Fragment, [
        a({
          style: { ...styles.tab, ...(selected ? styles.activeTab : {}) },
          onClick: selected ? refresh : undefined,
          href
        }, tabName),
        navSeparator
      ])
    }
    return contextBar({ style: styles.tabContainer }, [
      navSeparator,
      navTab({ tabName: 'dashboard', href: Nav.getLink('workspace', { namespace, name }) }),
      navTab({ tabName: 'notebooks', href: Nav.getLink('workspace-notebooks', { namespace, name }) }),
      navTab({ tabName: 'data', href: Nav.getLink('workspace-data', { namespace, name }) }),
      navTab({ tabName: 'jobs' }),
      navTab({ tabName: 'history' }),
      navTab({ tabName: 'tools', href: Nav.getLink('workspace-tools', { namespace, name }) }),
      div({ style: { flexGrow: 1 } }),
      h(Interactive, { as: 'div', ...navIconProps }, [icon('copy', { size: 22 })]),
      h(PopupTrigger, {
        ref: this.menu,
        content: contextMenu([
          { children: 'Share' },
          { children: 'Publish' },
          {
            children: 'Delete',
            disabled: !workspace || !_.includes(workspace.accessLevel, ['OWNER', 'PROJECT_OWNER']),
            onClick: () => {
              onDelete()
              this.menu.current.close()
            }
          }
        ]),
        position: 'bottom'
      }, [
        h(Interactive, { as: 'div', ...navIconProps }, [icon('ellipsis-vertical', { size: 22 })])
      ])
    ])
  }
}


class DeleteWorkspaceModal extends Component {
  state = {
    deleting: false,
    workspace: undefined
  }

  async deleteWorkspace() {
    const { namespace, name } = this.props
    try {
      this.setState({ deleting: true })
      await Rawls.workspace(namespace, name).delete()
      Nav.goToPath('workspaces')
    } catch (error) {
      reportError('Error deleting project', error)
      this.setState({ deleting: false })
    }
  }

  async componentDidMount() {
    const { namespace, name } = this.props
    try {
      const workspace = await Rawls.workspace(namespace, name).details()
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
      div(['Are you sure you want to permanently delete this project?']),
      div({ style: { marginTop: '1rem' } }, [
        'Deleting it will delete the associated ',
        link({ target: '_blank', href: bucketUrl(workspace && workspace.workspace.bucketName) }, [
          'Google Cloud Bucket'
        ]),
        ' and all its data.'
      ]),
      deleting && spinnerOverlay
    ])
  }
}


export default class WorkspaceContainer extends Component {
  state = {
    deletingWorkspace: false,
    workspace: undefined
  }

  onDelete = () => {
    this.setState({ deletingWorkspace: true })
  }

  async componentDidMount() {
    const { namespace, name } = this.props
    try {
      const workspace = await Rawls.workspace(namespace, name).details()
      this.setState({ workspace })
    } catch (error) {
      reportError('Error loading workspace', error)
    }
  }

  render() {
    const { namespace, name, breadcrumbs, title, activeTab, refresh } = this.props
    const { deletingWorkspace, workspace } = this.state

    return div({ style: { display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 } }, [
      h(TopBar, { title: 'Projects' }, [
        div({ style: { display: 'flex', flexDirection: 'column', paddingLeft: '4rem' } },
          [
            div({}, breadcrumbs),
            div({ style: { fontSize: '1.25rem' } }, [title || `${namespace}/${name}`])
          ]),
        h(ClusterManager, { namespace })
      ]),
      h(WorkspaceTabs, { namespace, name, activeTab, refresh, workspace, onDelete: this.onDelete }),
      div({ style: { position: 'relative', flexGrow: 1 } }, [
        this.props.children
      ]),
      deletingWorkspace && h(DeleteWorkspaceModal, {
        namespace, name,
        onDismiss: () => this.setState({ deletingWorkspace: false })
      })
    ])
  }
}
