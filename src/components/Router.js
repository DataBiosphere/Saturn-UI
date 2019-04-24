import _ from 'lodash/fp'
import { Component } from 'react'
import { div, h, h2 } from 'react-hyperscript-helpers'
import AuthContainer from 'src/components/AuthContainer'
import { link } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { notify } from 'src/components/Notifications'
import TopBar from 'src/components/TopBar'
import { isFirecloud } from 'src/libs/logos'
import * as Nav from 'src/libs/nav'
import * as Code from 'src/pages/library/Code'
import * as Datasets from 'src/pages/library/Datasets'
import * as Group from 'src/pages/groups/Group'
import * as Groups from 'src/pages/groups/List'
import * as LandingPage from 'src/pages/LandingPage'
import * as ImportData from 'src/pages/ImportData'
import * as ImportTool from 'src/pages/ImportTool'
import * as Showcase from 'src/pages/library/Showcase'
import * as PrivacyPolicy from 'src/pages/PrivacyPolicy'
import * as Profile from 'src/pages/Profile'
import * as StyleGuide from 'src/pages/StyleGuide'
import * as WorkspaceList from 'src/pages/workspaces/List'
import * as Dashboard from 'src/pages/workspaces/workspace/Dashboard'
import * as Data from 'src/pages/workspaces/workspace/Data'
import * as JobHistory from 'src/pages/workspaces/workspace/JobHistory'
import * as SubmissionDetails from 'src/pages/workspaces/workspace/jobHistory/SubmissionDetails'
import * as Notebooks from 'src/pages/workspaces/workspace/Notebooks'
import * as NotebookLauncher from 'src/pages/workspaces/workspace/notebooks/NotebookLauncher'
import * as TerminalLauncher from 'src/pages/workspaces/workspace/notebooks/TerminalLauncher'
import * as TermsOfService from 'src/pages/TermsOfService'
import * as Tools from 'src/pages/workspaces/workspace/Tools'
import * as WorkflowView from 'src/pages/workspaces/workspace/tools/WorkflowView'
import * as Projects from 'src/pages/billing/List'


const pageWrapStyle = { display: 'flex', flexDirection: 'column', flex: '1 0 auto', position: 'relative' }

const initNavPaths = () => {
  Nav.clearPaths()
  LandingPage.addNavPaths()
  WorkspaceList.addNavPaths()
  WorkflowView.addNavPaths()
  StyleGuide.addNavPaths()
  ImportData.addNavPaths()
  ImportTool.addNavPaths()
  PrivacyPolicy.addNavPaths()
  Dashboard.addNavPaths()
  Data.addNavPaths()
  Notebooks.addNavPaths()
  JobHistory.addNavPaths()
  SubmissionDetails.addNavPaths()
  Tools.addNavPaths()
  NotebookLauncher.addNavPaths()
  Profile.addNavPaths()
  Groups.addNavPaths()
  Group.addNavPaths()
  TerminalLauncher.addNavPaths()
  TermsOfService.addNavPaths()
  Code.addNavPaths()
  Datasets.addNavPaths()
  Showcase.addNavPaths()
  Projects.addNavPaths()
}

export default class Router extends Component {
  constructor(props) {
    super(props)
    this.state = { pathname: undefined }
  }

  componentDidMount() {
    initNavPaths()
    this.setState({ pathname: Nav.history.location.pathname, search: Nav.history.location.search })
    this.unlisten = Nav.history.listen(
      ({ pathname, search }) => this.setState({ pathname, search })
    )

    if (isFirecloud() && new URLSearchParams(window.location.search).has('fcredir')) {
      notify('welcome', div({ style: { fontSize: 14 } }, [
        div(['Welcome to the new FireCloud interface, powered by Terra. All of your workspaces are available. ',
          link({
            target: '_blank',
            href: 'https://broadinstitute.zendesk.com/hc/en-us/sections/360003528231-FireCloud-users-Find-out-what-s-new-in-Terra',
            variant: 'light'
          },
          'Learn what\'s new and different.'
          )]),
        div({ style: { marginTop: '1rem' } }, ['The legacy FireCloud is still available until ' +
        'August 2019. Click the three-bar menu on the upper-left corner and select "Use Classic FireCloud".']),
        div({ style: { marginTop: '1rem' } }, ['Please update your bookmarks to our new URL, firecloud.terra.bio. ' +
        'Welcome to the future of FireCloud!'])
      ]))
      window.history.replaceState(null, '', `/${window.location.hash}`)
    }
  }

  // FIXME - shouldn't be using unsafe methods
  UNSAFE_componentWillReceiveProps() { // eslint-disable-line camelcase
    initNavPaths()
  }

  componentDidUpdate(prevProps, prevState) {
    const { pathname, search } = this.state
    if (prevState.pathname === pathname) return

    const handler = Nav.findHandler(pathname)

    if (handler && handler.title) {
      if (_.isFunction(handler.title)) {
        document.title = handler.title(Nav.getHandlerProps(handler, pathname, search))
      } else {
        document.title = handler.title
      }
    } else {
      document.title = 'Terra'
    }
  }

  componentWillUnmount() {
    this.unlisten()
  }

  render() {
    const { pathname, search } = this.state
    if (pathname === undefined) {
      return null
    }
    const handler = Nav.findHandler(pathname)
    if (!handler) {
      return h(FooterWrapper, [
        h(TopBar),
        div({ style: { marginLeft: '1rem', ...pageWrapStyle } }, [
          h2('Page not found')
        ])
      ])
    }
    const el = div({ style: pageWrapStyle }, [
      h(handler.component, {
        key: pathname, // forces a remount even if component is the same
        ...Nav.getHandlerProps(handler, pathname, search)
      })
    ])
    return h(AuthContainer, { isPublic: handler.public }, [el])
  }
}
