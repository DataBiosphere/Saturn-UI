import { Fragment } from 'react'
import { hot } from 'react-hot-loader'
import { div, h, h2 } from 'react-hyperscript-helpers'
import { buttonPrimary } from 'src/components/common'
import Modal from 'src/components/Modal'
import { Sam } from 'src/libs/ajax'
import * as Config from 'src/libs/config'
import * as Nav from 'src/libs/nav'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import * as StyleGuide from 'src/pages/StyleGuide'
import * as WorkspaceList from 'src/pages/workspaces/List'
import * as WorkspaceContainer from 'src/pages/workspaces/workspace/Container'


const initNavPaths = () => {
  Nav.clearPaths()
  WorkspaceList.addNavPaths()
  WorkspaceContainer.addNavPaths()
  StyleGuide.addNavPaths()
}

class Main extends Component {
  componentWillMount() {
    initNavPaths()
    this.handleHashChange()
    Config.loadConfig().then(() => this.loadAuth())
  }

  render() {
    const { isSignedIn, isShowingNotRegisteredModal } = this.state

    return h(Fragment, [
      div({ id: 'signInButton', style: { display: isSignedIn ? 'none' : 'block' } }),
      isShowingNotRegisteredModal ? this.renderNotRegisteredModal() : null,
      isSignedIn ? this.renderSignedIn() : null
    ])
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.handleHashChange)
  }

  componentWillReceiveProps() { initNavPaths() }

  componentWillUnmount() { window.removeEventListener('hashchange', this.handleHashChange) }

  loadAuth = () => {
    window.gapi.load('auth2', () => {
      window.gapi.auth2.init({
        clientId: Config.getGoogleClientId()
      }).then(() => {
        this.handleSignIn(Utils.getUser().isSignedIn())
        Utils.getAuthInstance().isSignedIn.listen(this.handleSignIn)

        window.gapi.signin2.render('signInButton', { scope: 'openid profile email' })
      })
    })
  }

  handleSignIn = isSignedIn => {
    this.setState({ isSignedIn })
    if (isSignedIn) {
      Sam.getUserStatus(
        ({ enabled: { ldap } }) => {
          if (!ldap) {
            this.setState({ isShowingNotRegisteredModal: true })
          }
        },
        failure => Utils.log('Error looking up user status:', failure))
    }
  }

  handleHashChange = () => {
    if (!Nav.executeRedirects(window.location.hash)) {
      this.setState({ windowHash: window.location.hash })
    }
  }

  renderSignedIn = () => {
    const { windowHash } = this.state
    const { component, makeProps } = Nav.findPathHandler(windowHash) || {}

    return component ? h(component, makeProps()) : h2('No matching path.')
  }

  renderNotRegisteredModal = () => {
    return Modal({
      onDismiss: () => this.setState({ isShowingNotRegisteredModal: false }),
      title: 'Account Not Registered',
      showCancel: false,
      okButton: buttonPrimary(
        { onClick: () => this.setState({ isShowingNotRegisteredModal: false }) }, 'OK')
    }, 'Registering in Saturn is not yet supported. Please register by logging into FireCloud.')
  }
}

export default hot(module)(Main)
