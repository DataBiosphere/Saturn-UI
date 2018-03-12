import _ from 'underscore'
import { Component, Fragment } from 'react'
import { a, div, h } from 'react-hyperscript-helpers'
import * as Ajax from 'src/libs/ajax'
import { topBar } from 'src/components/common'
import { breadcrumb, icon } from 'src/components/icons'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import WorkspaceData from 'src/pages/workspaces/workspace/Data'


const navSeparator = div({
  style: {
    background: 'rgba(255,255,255,0.15)', width: 1, height: '3rem',
    flexShrink: 0
  }
})

const tabActiveState = {
  backgroundColor: 'rgba(255,255,255,0.15)',
  opacity: 1,
  lineHeight: 'calc(4rem - 8px)',
  borderBottom: `8px solid ${Style.colors.secondary}`
}

const navTab = (name, isActive = false) => {
  return h(Fragment, [
    div({
      style: _.extend({ opacity: 0.65, maxWidth: 140, flexGrow: 1 },
        isActive ? tabActiveState : {})
    }, name),
    navSeparator
  ])
}

const navIcon = shape => {
  return icon(shape, { size: 22, style: { opacity: 0.65, paddingRight: '1rem' } })
}

class WorkspaceContainer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      workspaceEntities: {},
      selectedEntityType: '',
      selectedEntities: []
    }
  }

  componentWillMount() {
    const { namespace, name } = this.props

    Ajax.rawls(`workspaces/${namespace}/${name}`).then(json =>
      this.setState({ workspace: json })
    )

    Ajax.rawls(`workspaces/${namespace}/${name}/entities`).then(json =>
      this.setState({ workspaceEntities: json })
    )

  }

  render() {
    const { namespace, name } = this.props
    const { workspaceEntities } = this.state

    return h(Fragment, [
      topBar([
        div({ style: { display: 'flex', flexDirection: 'column', paddingLeft: '4rem' } },
          [
            a({
                style: { color: Style.colors.textFaded, cursor: 'pointer', textDecoration: 'none' },
                href: Nav.getLink('workspaces')
              },
              ['Projects', breadcrumb()]),
            div({ style: { color: Style.colors.text, fontSize: '1.25rem' } },
              `${namespace}/${name}`)
          ])
      ]),
      div({
        style: {
          display: 'flex', height: '4rem', paddingLeft: '5rem', textAlign: 'center',
          backgroundColor: Style.colors.primary, color: 'white', lineHeight: '4rem',
          textTransform: 'uppercase', alignItems: 'center',
          borderBottom: `5px solid ${Style.colors.secondary}`
        }
      }, [
        navSeparator,
        navTab('Dashboard'), navTab('Notebooks'), navTab('Data', true), navTab('Jobs'),
        navTab('History'), navTab('Tools'), div({ style: { flexGrow: 1 } }),
        navIcon('copy'), navIcon('ellipsis-vertical')
      ]),
      WorkspaceData({ namespace, name, workspaceEntities })
    ])
  }
}


const addNavPaths = () => {
  Nav.defPath(
    'workspace',
    {
      component: props => h(WorkspaceContainer, props),
      regex: /workspaces\/([^/]+)\/([^/]+)/,
      makeProps: (namespace, name) => ({ namespace, name }),
      makePath: (namespace, name) => `workspaces/${namespace}/${name}`
    }
  )
}

export { addNavPaths }
