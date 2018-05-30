import { createPortal } from 'react-dom'
import { a, div } from 'react-hyperscript-helpers'
import { link } from 'src/components/common'
import { icon, logo } from 'src/components/icons'
import { signOut } from 'src/libs/auth'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import { Component } from 'src/libs/wrapped-components'


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
      div(
        {
          style: {
            display: 'flex', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            overflow: 'auto', cursor: 'pointer'
          },
          onClick: () => this.hideNav()
        },
        [
          div({
            style: {
              zIndex: 1,
              /*
               * MP: Rotating the 'angle' icon for breadcrumbs creates a new stacking context,
               * causing it to appear above the overlay.
               */
              display: 'table', width: 275, color: 'white', position: 'absolute', cursor: 'default',
              backgroundColor: Style.colors.primary, height: '100%',
              boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)'
            },
            onClick: e => e.stopPropagation()
          }, [
            div({
              style: {
                ...Style.elements.pageTitle,
                backgroundColor: 'white', padding: '1rem',
                textAlign: 'center', display: 'flex', alignItems: 'center'
              }
            }, [
              icon('bars',
                {
                  dir: 'right',
                  size: 36,
                  style: { marginRight: '2rem', color: Style.colors.accent, cursor: 'pointer' },
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
            div({
              style: {
                padding: '1rem', borderBottom: '1px solid white', color: 'white',
                lineHeight: '1.75rem'
              }
            }, [icon('search', { style: { margin: '0 1rem 0 1rem' } }), 'Find Data']),
            div({
              style: {
                padding: '1rem', borderBottom: '1px solid white', color: 'white',
                lineHeight: '1.75rem'
              }
            }, [icon('search', { style: { margin: '0 1rem 0 1rem' } }), 'Find Code']),
            a({
              style: {
                padding: '1rem', borderBottom: '1px solid white', color: 'white',
                lineHeight: '1.75rem', textDecoration: 'none', display: 'block'
              },
              href: Nav.getLink('workspaces'),
              onClick: () => this.hideNav()
            }, [
              icon('grid-view', { class: 'is-solid', style: { margin: '0 1rem 0 1rem' } }),
              'Projects'
            ])
          ])
        ]),
      document.getElementById('main-menu-container')
    )
  }

  render() {
    return div(
      {
        style: {
          flex: 'none',
          backgroundColor: 'white', padding: '1rem',
          display: 'flex', alignItems: 'center'
        }
      },
      [
        icon('bars',
          {
            size: 36,
            style: { marginRight: '2rem', color: Style.colors.accent, cursor: 'pointer' },
            onClick: () => this.showNav()
          }),
        a({
          style: { ...Style.elements.pageTitle, display: 'flex', alignItems: 'center' },
          href: Nav.getLink('workspaces')
        },
        [
          logo(),
          div({}, [
            div({
              style: { fontSize: '0.8rem', color: Style.colors.titleAlt, marginLeft: '0.1rem' }
            }, 'Saturn'),
            this.props.title
          ])
        ]),
        this.props.children,
        link({
          style: { flexShrink: 0, marginLeft: 'auto' },
          onClick: signOut
        }, 'Sign out'),
        this.state.navShown && this.buildNav()
      ]
    )
  }
}
