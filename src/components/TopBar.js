import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import { a, b, div, h } from 'react-hyperscript-helpers'
import Collapse from 'src/components/Collapse'
import { Clickable, comingSoon, MenuButton } from 'src/components/common'
import { icon, logo, profilePic } from 'src/components/icons'
import { pushNotification } from 'src/components/Notifications'
import SignInButton from 'src/components/SignInButton'
import SupportRequestModal from 'src/components/SupportRequestModal'
import { authStore, getUser, signOut } from 'src/libs/auth'
import colors from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


const styles = {
  topBar: {
    flex: 'none', height: 90,
    backgroundColor: 'white', paddingLeft: '1rem',
    display: 'flex', alignItems: 'center',
    borderBottom: `2px solid ${colors.blue[0]}`,
    boxShadow: Style.standardShadow, zIndex: 1
  },
  nav: {
    background: {
      position: 'fixed', left: 0, right: 0, top: 0, bottom: 0,
      overflow: 'auto', cursor: 'pointer'
    },
    container: {
      width: 350, color: 'white', position: 'absolute', cursor: 'default',
      backgroundColor: colors.darkBlue[0], height: '100%',
      boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column'
    },
    profile: active => ({
      backgroundColor: active ? colors.gray[5] : colors.gray[4],
      color: colors.darkBlue[0],
      borderBottom: active ? undefined : 'none'
    }),
    profileItem: active => ({
      ...styles.nav.profile(active),
      borderTop: `1px solid ${colors.darkBlue[0]}`,
      padding: '0 3rem', height: 40,
      fontSize: 'unset',
      fontWeight: 500
    }),
    item: {
      display: 'flex', alignItems: 'center', flex: 'none',
      height: 70, padding: '0 3rem',
      fontWeight: 600,
      borderBottom: `1px solid ${colors.darkBlue[2]}`, color: 'white'
    },
    miniItem: {
      display: 'flex', alignItems: 'center',
      margin: '1rem 3rem',
      fontWeight: 600
    },
    icon: {
      width: 32, marginRight: '0.5rem', flex: 'none'
    }
  }
}

const betaTag = b({
  style: {
    fontSize: 8, lineHeight: '9px',
    color: 'white', backgroundColor: colors.brick,
    padding: '3px 5px', marginLeft: '0.4rem', verticalAlign: 'middle',
    borderRadius: 2
  }
}, 'BETA')

export default Utils.connectAtom(authStore, 'authState')(class TopBar extends Component {
  static propTypes = {
    title: PropTypes.node,
    href: PropTypes.string, // link destination
    children: PropTypes.node
  }

  showNav() {
    this.setState({ navShown: true })
    document.body.classList.add('overlayOpen')
    if (document.body.scrollHeight > window.innerHeight) {
      document.body.classList.add('overHeight')
    }
  }

  hideNav() {
    this.setState({ navShown: false, userMenuOpen: false })
    document.body.classList.remove('overlayOpen', 'overHeight')
  }

  buildNav() {
    const { authState: { isSignedIn } } = this.props

    return createPortal(
      div({
        style: styles.nav.background,
        onClick: () => {
          this.hideNav()
        }
      }, [
        div({
          style: styles.nav.container,
          onClick: e => e.stopPropagation()
        }, [
          div({ style: styles.topBar }, [
            icon('bars', {
              dir: 'right',
              size: 36,
              style: { marginRight: '2rem', color: colors.purple[0], cursor: 'pointer' },
              onClick: () => this.hideNav()
            }),
            a({
              style: {
                ...Style.elements.pageTitle,
                textAlign: 'center', display: 'flex', alignItems: 'center'
              },
              href: Nav.getLink('root'),
              onClick: () => this.hideNav()
            }, [logo(), 'Terra', betaTag])
          ]),
          isSignedIn ?
            this.buildUserSection() :
            div({ style: { ...styles.nav.item, ...styles.nav.profile(false), boxShadow: `inset ${Style.standardShadow}` } }, [
              h(SignInButton)
            ]),
          h(Clickable, {
            as: 'a',
            style: styles.nav.item,
            hover: { backgroundColor: colors.darkBlue[1] },
            href: Nav.getLink('browse-data'),
            onClick: () => this.hideNav()
          }, [
            div({ style: styles.nav.icon }, [
              icon('browse', { size: 24 })
            ]),
            'Browse Data'
          ]),
          div({ style: styles.nav.item }, [
            div({ style: styles.nav.icon }, [
              icon('search', { size: 24 })
            ]),
            'Find Code', comingSoon
          ]),
          h(Clickable, {
            as: 'a',
            style: styles.nav.item,
            hover: { backgroundColor: colors.darkBlue[1] },
            href: Nav.getLink('workspaces'),
            onClick: () => this.hideNav()
          }, [
            div({ style: styles.nav.icon }, [
              icon('workspace', { className: 'is-solid', size: 24 })
            ]),
            'See All Workspaces'
          ]),
          div({ style: { marginTop: '2rem' } }, [
            h(Clickable, {
              style: styles.nav.miniItem,
              onClick: () => this.setState({ showingSupportModal: true })
            }, [
              div({ style: styles.nav.icon }, [
                icon('envelope', { className: 'is-solid', size: 24 })
              ]),
              'Contact Us'
            ])
          ]),
          div({
            style: {
              ..._.omit('borderBottom', styles.nav.item), marginTop: 'auto',
              color: colors.darkBlue[2],
              fontSize: 10, marginBottom: '5rem'
            }
          }, [
            'Built on: ',
            new Date(SATURN_BUILD_TIMESTAMP).toLocaleString()
          ])
        ])
      ]),
      document.getElementById('main-menu-container')
    )
  }

  buildUserSection() {
    const { userMenuOpen } = this.state

    return h(Collapse, {
      defaultHidden: true,
      showIcon: false,
      animate: true,
      expandTitle: true,
      style: styles.nav.profile(false),
      buttonStyle: { marginBottom: 0 },
      title: [
        h(Clickable, {
          style: { ...styles.nav.item, ...styles.nav.profile(userMenuOpen), boxShadow: `inset ${Style.standardShadow}` },
          hover: styles.nav.profile(true),
          onClick: () => this.setState({ userMenuOpen: !userMenuOpen })
        }, [
          div({ style: styles.nav.icon }, [
            profilePic({ size: 32 })
          ]),
          div({ style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, [
            getUser().name
          ]),
          div({ style: { flexGrow: 1 } }),
          icon(`angle ${userMenuOpen ? 'up' : 'down'}`,
            { size: 18, style: { flex: 'none' } })
        ])
      ]
    }, [
      h(MenuButton, {
        as: 'a',
        href: Nav.getLink('profile'),
        style: styles.nav.profileItem(false),
        hover: styles.nav.profileItem(true),
        onClick: () => this.hideNav() // In case we're already there
      }, [
        icon('user', { style: styles.nav.icon }), 'Profile'
      ]),
      h(MenuButton, {
        as: 'a',
        href: Nav.getLink('groups'),
        style: styles.nav.profileItem(false),
        hover: styles.nav.profileItem(true),
        onClick: () => this.hideNav() // In case we're already there
      }, [
        icon('users', { style: styles.nav.icon }), 'Groups'
      ]),
      h(MenuButton, {
        onClick: signOut,
        style: styles.nav.profileItem(false),
        hover: styles.nav.profileItem(true)
      }, [
        icon('logout', { style: styles.nav.icon }), 'Sign Out'
      ])
    ])
  }

  render() {
    const { title, href, children } = this.props
    const { navShown, showingSupportModal } = this.state

    return div({ style: styles.topBar }, [
      icon('bars', {
        size: 36,
        style: { marginRight: '2rem', color: colors.purple[0], flex: 'none', cursor: 'pointer' },
        onClick: () => this.showNav()
      }),
      a({
        style: { ...Style.elements.pageTitle, display: 'flex', alignItems: 'center' },
        href: href || Nav.getLink('root')
      }, [
        logo(),
        div({}, [
          div({
            style: _.merge(title ? { fontSize: '0.8rem', lineHeight: '19px' } : { fontSize: '1rem', fontWeight: 600 },
              { color: colors.darkBlue[2], marginLeft: '0.1rem' })
          }, ['Terra', betaTag]),
          title
        ])
      ]),
      children,
      navShown && this.buildNav(),
      showingSupportModal && h(SupportRequestModal, {
        onDismiss: () => this.setState({ showingSupportModal: false }),
        onSuccess: () => {
          this.setState({ showingSupportModal: false })
          pushNotification({ message: 'Message sent successfully' })
        }
      })
    ])
  }
})
