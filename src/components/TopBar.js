import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Fragment, useState } from 'react'
import { a, b, div, h, span } from 'react-hyperscript-helpers'
import Collapse from 'src/components/Collapse'
import { buttonPrimary, Clickable, LabeledCheckbox, spinnerOverlay } from 'src/components/common'
import { icon, profilePic } from 'src/components/icons'
import { TextArea } from 'src/components/input'
import Modal from 'src/components/Modal'
import SignInButton from 'src/components/SignInButton'
import headerLeftHexes from 'src/images/header-left-hexes.svg'
import headerRightHexes from 'src/images/header-right-hexes.svg'
import { Ajax, ajaxCaller } from 'src/libs/ajax'
import { refreshTerraProfile, signOut } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { getConfig, isFirecloud, isTerra } from 'src/libs/config'
import { reportError, withErrorReporting } from 'src/libs/error'
import { FormLabel } from 'src/libs/forms'
import { topBarLogo } from 'src/libs/logos'
import * as Nav from 'src/libs/nav'
import { authStore, contactUsActive, freeCreditsActive } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import { CookiesModal } from 'src/pages/SignIn'


const styles = {
  topBar: {
    flex: 'none', height: 66, paddingLeft: '1rem',
    display: 'flex', alignItems: 'center',
    borderBottom: `2px solid ${colors.primary(0.55)}`,
    zIndex: 2,
    boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)'
  },
  pageTitle: {
    color: isTerra() ? 'white' : colors.dark(), fontSize: 22, fontWeight: 500, textTransform: 'uppercase'
  },
  nav: {
    background: {
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
      overflow: 'auto', cursor: 'pointer',
      zIndex: 2
    },
    container: {
      paddingTop: 66,
      width: 290, color: 'white', position: 'absolute', cursor: 'default',
      backgroundColor: colors.dark(0.7), height: '100%',
      boxShadow: '3px 0 13px 0 rgba(0,0,0,0.3)',
      zIndex: 2,
      display: 'flex', flexDirection: 'column'
    },
    item: {
      display: 'flex', alignItems: 'center', flex: 'none',
      height: 70, padding: '0 28px',
      fontWeight: 600,
      borderTop: `1px solid ${colors.dark(0.55)}`, color: 'white'
    },
    dropDownItem: {
      display: 'flex', alignItems: 'center',
      backgroundColor: colors.dark(0.7),
      color: 'white',
      borderBottom: 'none',
      padding: '0 3rem', height: 40,
      fontSize: 'unset',
      fontWeight: 500
    },
    icon: {
      marginRight: 12, flex: 'none'
    }
  }
}

const betaTag = b({
  style: {
    fontSize: 8, lineHeight: '9px',
    color: 'white', backgroundColor: colors.primary(0.75),
    padding: '3px 5px', verticalAlign: 'middle',
    borderRadius: 2
  }
}, 'BETA')

class DropDownSubItem extends Component {
  static propTypes = {
    href: PropTypes.string,
    title: PropTypes.string,
    onClick: PropTypes.func
  }

  render() {
    const { href, title, onClick, ...props } = this.props

    return h(Clickable, {
      as: 'a',
      href,
      style: styles.nav.dropDownItem,
      hover: {
        ...styles.nav.dropDownItem,
        backgroundColor: colors.dark(0.55)
      },
      onClick,
      ...props
    }, [title])
  }
}

class BuildDropDownSection extends Component {
  static propTypes = {
    titleIcon: PropTypes.string,
    title: PropTypes.any, //wat would this be, usually string but also is a div
    menuOpen: PropTypes.bool,
    onClick: PropTypes.func,
    subItems: PropTypes.array
  }

  render() {
    const { titleIcon, title, menuOpen, onClick, subItems } = this.props

    return h(Collapse, {
      defaultHidden: true,
      showIcon: false,
      animate: true,
      expandTitle: true,
      buttonStyle: { marginBottom: 0 },
      title: [
        h(Clickable, {
          style: styles.nav.item,
          hover: { backgroundColor: colors.dark(0.55) },
          onClick
        }, [
          titleIcon && div({ style: styles.nav.icon }, [
            icon(titleIcon, {
              className: 'is-solid',
              size: 24
            })
          ]),
          div({
            style: {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }, [title]),
          div({ style: { flexGrow: 1 } }),
          icon(`angle ${menuOpen ? 'up' : 'down'}`,
            {
              size: 18,
              style: { flex: 'none' }
            })
        ])
      ]
    }, subItems)
  }
}

export default _.flow(
  ajaxCaller,
  Utils.connectAtom(authStore, 'authState')
)(class TopBar extends Component {
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
    this.setState({ navShown: false, openUserMenu: false, openLibraryMenu: false, openSupportMenu: false })
    document.body.classList.remove('overlayOpen', 'overHeight')
  }

  buildNav() {
    const { authState: { isSignedIn, profile,  profile: { firstName = 'Loading...', lastName = '' }  } } = this.props
    const { trialState } = profile
    const { openLibraryMenu, openSupportMenu, openUserMenu } = this.state


    const enabledCredits = h(Clickable, {
      style: styles.nav.item,
      hover: { backgroundColor: colors.dark(0.55) },
      onClick: () => {
        this.hideNav()
        freeCreditsActive.set(true)
      }
    }, [
      div({ style: styles.nav.icon }, [
        icon('cloud', {
          className: 'is-solid',
          size: 20
        })
      ]),
      'Sign up for free credits'
    ])

    const enrolledCredits = h(Clickable, {
      style: styles.nav.item,
      as: 'a',
      hover: { backgroundColor: colors.dark(0.55) },
      href: 'https://software.broadinstitute.org/firecloud/documentation/freecredits',
      ...Utils.newTabLinkProps,
      onClick: () => this.hideNav()
    }, [
      div({ style: styles.nav.icon }, [
        icon('cloud', {
          className: 'is-solid',
          size: 20
        })
      ]),
      'Access free credits',
      icon('pop-out', {
        size: 20,
        style: { paddingLeft: '0.5rem' }
      })
    ])

    const terminatedCredits = h(Clickable, {
      style: styles.nav.item,
      hover: { backgroundColor: colors.dark(0.55) },
      onClick: () => this.setState({ finalizeTrial: true })
    }, [
      div({ style: styles.nav.icon }, [
        icon('cloud', {
          className: 'is-solid',
          size: 20
        })
      ]),
      'Your free trial has ended'
    ])

    return div({
      style: styles.nav.background,
      onClick: () => {
        this.hideNav()
      }
    }, [
      div({
        style: styles.nav.container,
        onClick: e => e.stopPropagation()
      }, [
        div({ style: { display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 } }, [
          isSignedIn ?
            h(BuildDropDownSection, {
              titleIcon: undefined,
              title: div({ style: { ..._.omit('borderTop', styles.nav.item), padding: 0 } }, [
                profilePic({ size: 32, style: { marginRight: 12 } }), `${firstName} ${lastName}`
              ]),
              onClick: () => this.setState({ openUserMenu: !openUserMenu }),
              openUserMenu,
              subItems: [
                h(DropDownSubItem, {
                  href: Nav.getLink('profile'),
                  title: 'Profile',
                  onClick: () => this.hideNav()
                }),
                h(DropDownSubItem, {
                  href: Nav.getLink('groups'),
                  title: 'Groups',
                  onClick: () => this.hideNav()
                }),
                h(DropDownSubItem, {
                  href: Nav.getLink('billing'),
                  title: 'Billing',
                  onClick: () => this.hideNav()
                }),
                h(DropDownSubItem, {
                  title: 'Sign Out',
                  onClick: signOut
                })
              ]
            }) :
            div({
              style: {
                ...styles.nav.item,
                justifyContent: 'center',
                height: 95
              }
            }, [
              div([
                h(Clickable, {
                  hover: { textDecoration: 'underline' },
                  style: {
                    color: colors.accent(),
                    marginLeft: '9rem'
                  },
                  onClick: () => this.setState({ openCookiesModal: true })
                }, ['Cookies policy']),
                h(SignInButton)
              ])
            ]),
          h(Clickable, {
            as: 'a',
            style: styles.nav.item,
            hover: { backgroundColor: colors.dark(0.55) },
            href: Nav.getLink('workspaces'),
            onClick: () => this.hideNav()
          }, [
            div({ style: styles.nav.icon }, [
              icon('grid-chart', { className: 'is-solid', size: 24 })
            ]),
            'Your Workspaces'
          ]),
          h(Clickable, {
            as: 'a',
            ...Utils.newTabLinkProps,
            style: { ...styles.nav.item, borderBottom: `1px solid ${colors.dark(0.55)}` },
            hover: { backgroundColor: colors.dark(0.55) },
            href: getConfig().jobManagerUrlRoot,
            onClick: () => this.hideNav()
          }, [
            div({ style: styles.nav.icon }, [
              icon('layers', { className: 'is-solid', size: 24 })
            ]),
            'Job Manager'
          ]),
          div({ style: { margin: '5rem' } }),
          h(BuildDropDownSection, {
            titleIcon: 'library',
            title: 'Terra Library',
            onClick: () => this.setState({ openLibraryMenu: !openLibraryMenu }),
            openMenu: openLibraryMenu,
            subItems: [
              h(DropDownSubItem, {
                href: Nav.getLink('library-datasets'),
                title: 'Data',
                onClick: () => this.hideNav()
              }),
              h(DropDownSubItem, {
                href: Nav.getLink('library-showcase'),
                title: 'Showcase',
                onClick: () => this.hideNav()
              }),
              h(DropDownSubItem, {
                href: Nav.getLink('library-code'),
                title: 'Tools',
                onClick: () => this.hideNav()
              })
            ]
          }),
          (trialState === 'Enabled') && enabledCredits,
          (trialState === 'Enrolled') && enrolledCredits,
          (trialState === 'Terminated') && terminatedCredits,
          h(BuildDropDownSection, {
            titleIcon: 'help',
            title: 'Terra Support',
            onClick: () => this.setState({ openSupportMenu: !openSupportMenu }),
            openMenu: openSupportMenu,
            subItems: [
              h(DropDownSubItem, {
                href: 'https://support.terra.bio/hc/en-us',
                title: 'How-to Guides',
                onClick: () => this.hideNav(),
                ...Utils.newTabLinkProps
              }),
              h(DropDownSubItem, {
                href: 'https://support.terra.bio/hc/en-us/community/topics/360000500452',
                title: 'Request a Feature',
                onClick: () => this.hideNav(),
                ...Utils.newTabLinkProps
              }),
              h(DropDownSubItem, {
                href: 'https://support.terra.bio/hc/en-us/community/topics/360000500432',
                title: 'Community Forum',
                onClick: () => this.hideNav(),
                ...Utils.newTabLinkProps
              }),
              isFirecloud() && h(DropDownSubItem, {
                href: 'https://support.terra.bio/hc/en-us/articles/360022694271',
                title: 'What\'s different in Terra?',
                onClick: () => this.hideNav(),
                ...Utils.newTabLinkProps
              }),
              h(DropDownSubItem, {
                title: 'Contact Us',
                onClick: () => contactUsActive.set(true)
              })
            ]
          }),
          isFirecloud() && h(Clickable, {
            style: styles.nav.item,
            disabled: !isSignedIn,
            tooltip: isSignedIn ? undefined : 'Please sign in',
            hover: { backgroundColor: colors.gray[3] },
            onClick: () => this.setState({ openFirecloudModal: true })
          }, [
            div({ style: styles.nav.icon }, [
              icon('fcIconWhite', { className: 'is-solid', size: 20 })
            ]), 'Use Classic FireCloud'
          ]),
          div({
            style: {
              ..._.omit('borderTop', styles.nav.item),
              marginTop: 'auto',
              color: colors.dark(0.55),
              fontSize: 10
            }
          }, [
            'Built on: ',
            new Date(SATURN_BUILD_TIMESTAMP).toLocaleString()
          ])
        ])
      ])
    ])
  }

  render() {
    const { title, href, children, ajax: { User }, authState } = this.props
    const { navShown, finalizeTrial, openCookiesModal, openFirecloudModal } = this.state

    return h(Fragment, [
      navShown && this.buildNav(),
      div({
        style: {
          ...styles.topBar,
          background: isTerra() ?
            `81px url(${headerLeftHexes}) no-repeat, right url(${headerRightHexes}) no-repeat, ${colors.primary()}` :
            colors.secondary(0.15)
        }
      }, [
        icon('bars', {
          dir: navShown ? 'right' : undefined,
          size: 36,
          style: { marginRight: '2rem', color: isTerra() ? 'white' : colors.accent(), flex: 'none', cursor: 'pointer' },
          onClick: () => navShown ? this.hideNav() : this.showNav()
        }),
        a({
          style: { ...styles.pageTitle, display: 'flex', alignItems: 'center' },
          href: href || Nav.getLink('root')
        }, [
          topBarLogo(),
          div({}, [
            div({
              style: title ? { fontSize: '0.8rem', lineHeight: '19px' } : { fontSize: '1rem', fontWeight: 600 }
            }, [betaTag]),
            title
          ])
        ]),
        children,
        finalizeTrial && h(Modal, {
          title: 'Remove button',
          onDismiss: () => this.setState({ finalizeTrial: false }),
          okButton: buttonPrimary({
            onClick: async () => {
              try {
                await User.finalizeTrial()
                await refreshTerraProfile()
              } catch (error) {
                reportError('Error finalizing trial', error)
              } finally {
                this.setState({ finalizeTrial: false })
              }
            }
          }, ['Confirm'])
        }, ['Click confirm to remove button forever.']),
        openCookiesModal && h(CookiesModal, {
          onDismiss: () => this.setState({ openCookiesModal: false })
        }),
        openFirecloudModal && h(PreferFirecloudModal, {
          onDismiss: () => this.setState({ openFirecloudModal: false }),
          authState
        })
      ])
    ])
  }
})

const PreferFirecloudModal = ({ onDismiss }) => {
  const [emailAgreed, setEmailAgreed] = useState(true)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { profile: { email, firstName, lastName } } = Utils.useAtom(authStore)
  const currUrl = window.location.href

  const returnToLegacyFC = _.flow(
    withErrorReporting('Error opting out of Terra'),
    Utils.withBusyState(setSubmitting)
  )(async () => {
    await Ajax().User.profile.preferLegacyFirecloud()
    if (emailAgreed === true || reason.length !== 0) {
      await Ajax().User.createSupportRequest({
        name: `${firstName} ${lastName}`,
        email,
        description: reason,
        subject: 'Opt out of Terra',
        type: 'survey',
        attachmentToken: '',
        emailAgreed,
        currUrl
      })
    }
    onDismiss()
    window.location.assign(getConfig().firecloudUrlRoot)
  })

  return h(Modal, {
    onDismiss,
    title: 'Return to classic FireCloud',
    okButton: returnToLegacyFC
  }, [
    'Are you sure you would prefer the previous FireCloud interface?',
    h(FormLabel, ['Please tell us why']),
    h(TextArea, {
      style: { height: 100, marginBottom: '0.5rem' },
      placeholder: 'Enter your reason',
      value: reason,
      onChange: setReason
    }),
    h(LabeledCheckbox, {
      checked: emailAgreed,
      onChange: setEmailAgreed
    }, [span({ style: { marginLeft: '0.5rem' } }, ['You can follow up with me by email.'])]),
    submitting && spinnerOverlay
  ])
}
