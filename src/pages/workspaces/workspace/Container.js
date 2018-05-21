import _ from 'lodash'
import { Fragment } from 'react'
import { a, div, h } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import * as Breadcrumbs from 'src/components/breadcrumbs'
import { contextBar, contextMenu } from 'src/components/common'
import { icon, spinner } from 'src/components/icons'
import ShowOnClick from 'src/components/ShowOnClick'
import { TopBar } from 'src/components/TopBar'
import { Rawls } from 'src/libs/ajax'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import WorkspaceDashboard from 'src/pages/workspaces/workspace/Dashboard'
import WorkspaceData from 'src/pages/workspaces/workspace/Data'
import WorkspaceNotebooks from 'src/pages/workspaces/workspace/Notebooks'
import WorkspaceTools from 'src/pages/workspaces/workspace/Tools'


const navSeparator = div({
  style: { background: 'rgba(255,255,255,0.15)', width: 1, height: '3rem', flexShrink: 0 }
})

const tabBaseStyle = {
  maxWidth: 140, flexGrow: 1, color: Style.colors.textFadedLight, textDecoration: 'none',
  alignSelf: 'stretch', display: 'flex', justifyContent: 'center', alignItems: 'center'
}

const tabActiveStyle = {
  ...tabBaseStyle,
  backgroundColor: 'rgba(255,255,255,0.15)', color: 'unset',
  borderBottom: `4px solid ${Style.colors.secondary}`
}

const navIconProps = {
  size: 22,
  style: { opacity: 0.65, marginRight: '1rem' },
  hover: { opacity: 1 }, focus: 'hover'
}

const tabComponents = {
  dashboard: WorkspaceDashboard,
  notebooks: WorkspaceNotebooks,
  data: WorkspaceData,
  jobs: () => div('Job manager goes here'),
  history: () => div('Data history goes here'),
  tools: WorkspaceTools
}

/**
 * @param {string} namespace
 * @param {string} name
 * @param {string} [activeTab]
 */
export class WorkspaceContainer extends Component {
  constructor(props) {
    super(props)

    this.state = {
      forceUpdateKey: 0
    }
  }

  componentWillMount() {
    this.loadWorkspace()
  }

  loadWorkspace() {
    const { namespace, name } = this.props

    Rawls.workspace(namespace, name).details().then(
      workspace => this.setState({ workspace }),
      workspaceFailure => this.setState({ workspaceFailure })
    )
  }

  render() {
    const { namespace, name } = this.props
    const activeTab = this.props.activeTab || 'dashboard'

    const { forceUpdateKey, workspaceFailure, workspace } = this.state

    const navTab = tabName => {
      return h(Fragment, [
        a({
          style: tabName === activeTab ? tabActiveStyle : tabBaseStyle,
          href: Nav.getLink('workspace', {
            namespace, name, activeTab: tabName === 'dashboard' ? null : tabName
          }),
          onClick: () => {
            if (tabName === activeTab) {
              this.loadWorkspace()
              this.setState({ forceUpdateKey: forceUpdateKey + 1 })
            }
          }
        }, tabName),
        navSeparator
      ])
    }

    return h(Fragment, [
      h(TopBar, { title: 'Projects' }, [
        div({ style: { display: 'flex', flexDirection: 'column', paddingLeft: '4rem' } },
          [
            Breadcrumbs.commonElements.workspaces(),
            a({
              style: { fontSize: '1.25rem', textDecoration: 'none', color: 'unset' },
              href: Nav.getLink('workspace', { namespace, name })
            }, `${namespace}/${name}`)
          ])
      ]),
      contextBar({
        style: {
          paddingLeft: '5rem', borderBottom: `5px solid ${Style.colors.secondary}`,
          textAlign: 'center', color: 'white', lineHeight: '3.75rem', textTransform: 'uppercase'
        }
      }, [
        navSeparator,
        navTab('dashboard'), navTab('notebooks'), navTab('data'), navTab('jobs'),
        navTab('history'), navTab('tools'),
        div({ style: { flexGrow: 1 } }),
        h(Interactive,
          _.merge({ as: icon('copy') }, navIconProps)),
        h(ShowOnClick, {
          button: h(Interactive,
            _.merge({ as: icon('ellipsis-vertical') }, navIconProps))
        },
        [
          div({
            style: {
              position: 'absolute', right: 0, lineHeight: 'initial', textAlign: 'initial',
              color: 'initial', textTransform: 'initial', fontWeight: 300
            }
          }, [
            contextMenu([
              [{}, 'Share'],
              [{}, 'Publish'],
              [{}, 'Delete']
            ])
          ])
        ])
      ]),
      Utils.cond(
        [workspaceFailure, `Couldn't load workspace: ${workspaceFailure}`],
        [!workspace, () => spinner({ style: { marginTop: '2rem' } })],
        () => h(tabComponents[activeTab], _.merge({ key: forceUpdateKey }, workspace))
      )
    ])
  }
}

export const addNavPaths = () => {
  Nav.defPath('workspace', {
    path: '/workspaces/:namespace/:name/:activeTab?',
    component: WorkspaceContainer
  })
}
