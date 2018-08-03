import { Fragment } from 'react'
import { createPortal } from 'react-dom'
import { a, div, h } from 'react-hyperscript-helpers'
import { Clickable, comingSoon, MenuButton } from 'src/components/common'
import { icon, logo, profilePic } from 'src/components/icons'
import PopupTrigger from 'src/components/PopupTrigger'
import { getBasicProfile, signOut } from 'src/libs/auth'
import colors from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import { Component } from 'src/libs/wrapped-components'


const styles = {
  topBar: {
    flex: 'none', height: 80,
    backgroundColor: 'white', paddingLeft: '1rem',
    display: 'flex', alignItems: 'center',
    borderBottom: `2px solid ${colors.blue[0]}`
  },
  nav: {
    background: {
      display: 'flex', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
      overflow: 'auto', cursor: 'pointer'
    },
    container: {
      width: 350, color: 'white', position: 'absolute', cursor: 'default',
      backgroundColor: colors.darkBlue[1], height: '100%',
      boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)'
    },
    profile: {
      backgroundColor: colors.gray[5],
      color: colors.darkBlue[0], borderBottom: 'none'
    },
    item: {
      display: 'flex', alignItems: 'center',
      height: '4rem', paddingLeft: '2rem',
      borderBottom: `1px solid ${colors.darkBlue[2]}`, color: 'white'
    },
    icon: {
      width: '2.5rem', flex: 'none'
    },
    popup: {
      icon: {
        marginRight: '0.5rem'
      }
    }
  },
  userButton: {
    flex: 'none', alignSelf: 'stretch', display: 'flex', alignItems: 'center',
    marginLeft: 'auto', padding: '0 1rem', color: colors.blue[1]
  }
}

/**
 * @param {string} title
 * @param {array} [children]
 */
export class TopBar extends Component {
  showNav() {
    this.setState({ navShown: true })
    document.body.classList.add('overlayOpen')
    if (document.body.scrollHeight > window.innerHeight) {
      document.body.classList.add('overHeight')
    }
  }

  hideNav() {
    this.setState({ navShown: false })
    document.body.classList.remove('overlayOpen', 'overHeight')
  }

  buildNav() {
    return createPortal(
      div({
        style: styles.nav.background,
        onClick: () => this.hideNav()
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
              href: Nav.getLink('workspaces'),
              onClick: () => this.hideNav()
            }, [logo(), 'Saturn'])
          ]),
          div({ style: { ...styles.nav.item, ...styles.nav.profile } }, [
            div({ style: styles.nav.icon }, [
              profilePic({ size: 32 })
            ]),
            div({ style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, [
              getBasicProfile().getName()
            ]),
            h(PopupTrigger, {
              position: 'bottom',
              content: h(Fragment, [
                h(MenuButton, {
                  as: 'a',
                  href: Nav.getLink('profile'),
                  onClick: () => this.hideNav() // In case we're already there
                }, [
                  icon('user', { style: styles.nav.popup.icon }), 'Profile'
                ]),
                h(MenuButton, {
                  as: 'a',
                  href: Nav.getLink('groups'),
                  onClick: () => this.hideNav() // In case we're already there
                }, [
                  icon('users', { style: styles.nav.popup.icon }), 'Groups'
                ]),
                h(MenuButton, {
                  onClick: signOut
                }, [
                  icon('logout', { style: styles.nav.popup.icon }), 'Sign Out'
                ])
              ])
            }, [
              h(Clickable, {
                style: styles.userButton
              }, [icon('caretDown', { size: 18 })])
            ])
          ]),
          a({
            style: styles.nav.item,
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
          a({
            style: styles.nav.item,
            href: Nav.getLink('workspaces'),
            onClick: () => this.hideNav()
          }, [
            div({ style: styles.nav.icon }, [
              icon('workspace', { className: 'is-solid', size: 24 })
            ]),
            'Workspaces'
          ])
        ])
      ]),
      document.getElementById('main-menu-container')
    )
  }

  render() {
    const { title, href, children } = this.props
    const { navShown } = this.state

    return div({ style: styles.topBar }, [
      icon('bars', {
        size: 36,
        style: { marginRight: '2rem', color: colors.purple[0], cursor: 'pointer' },
        onClick: () => this.showNav()
      }),
      a({
        style: { ...Style.elements.pageTitle, display: 'flex', alignItems: 'center' },
        href: href || Nav.getLink('workspaces')
      }, [
        logo(),
        div({}, [
          div({
            style: { fontSize: '0.8rem', color: colors.slate, marginLeft: '0.1rem' }
          }, ['Saturn']),
          title
        ])
      ]),
      children,
      navShown && this.buildNav()
    ])
  }
}
