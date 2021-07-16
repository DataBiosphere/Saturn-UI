import { addDays, parseJSON } from 'date-fns/fp'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { Fragment, useState } from 'react'
import { div, h, h2, h3, span } from 'react-hyperscript-helpers'
import {
  ButtonPrimary, FrameworkServiceLink, IdContainer, LabeledCheckbox, Link, RadioButton, ShibbolethLink, spinnerOverlay, UnlinkFenceAccount
} from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { centeredSpinner, icon, profilePic, spinner } from 'src/components/icons'
import { TextInput, ValidatedInput } from 'src/components/input'
import { InfoBox } from 'src/components/PopupTrigger'
import TopBar from 'src/components/TopBar'
import { Ajax } from 'src/libs/ajax'
import { getUser, refreshTerraProfile } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { allProviders } from 'src/libs/providers'
import { authStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


const styles = {
  page: {
    margin: '0 2rem 2rem',
    width: 700
  },
  sectionTitle: {
    margin: '2rem 0 1rem',
    color: colors.dark(), fontSize: 16, fontWeight: 600, textTransform: 'uppercase'
  },
  header: {
    line: {
      margin: '0 2rem',
      display: 'flex', alignItems: 'center'
    },

    nameLine: {
      marginLeft: '1rem',
      color: colors.dark(),
      fontSize: '150%'
    }
  },
  form: {
    line: {
      display: 'flex', justifyContent: 'space-between',
      margin: '2rem 0'
    },
    container: {
      width: 320
    },
    title: {
      whiteSpace: 'nowrap', fontSize: 16,
      marginBottom: '0.3rem'
    },
    checkboxLine: {
      margin: '0.75rem 0'
    },
    checkboxLabel: {
      marginLeft: '0.5rem'
    }
  },
  identityLine: {
    display: 'flex',
    margin: '.3rem 0 0'
  }
}


const NihLink = ({ nihToken }) => {
  /*
   * Hooks
   */
  const { nihStatus } = Utils.useStore(authStore)
  const [linking, setLinking] = useState(false)
  const signal = Utils.useCancellation()

  Utils.useOnMount(() => {
    const { User } = Ajax(signal)

    const linkNihAccount = _.flow(
      withErrorReporting('Error linking NIH account'),
      Utils.withBusyState(setLinking)
    )(async () => {
      const nihStatus = await User.linkNihAccount(nihToken)
      authStore.update(state => ({ ...state, nihStatus }))
    })

    if (nihToken) {
      // Clear the query string, but use replace so the back button doesn't take the user back to the token
      Nav.history.replace({ search: '' })
      linkNihAccount()
    }
  })


  /*
   * Render helpers
   */
  const renderDatasetAuthStatus = ({ name, authorized }) => {
    return div({ key: `nih-auth-status-${name}`, style: styles.identityLine }, [
      div({ style: { flex: 1 } }, [`${name} Authorization`]),
      div({ style: { flex: 2 } }, [
        authorized ? 'Authorized' : span({ style: { marginRight: '0.5rem' } }, ['Not Authorized']),
        !authorized && h(InfoBox, [
          'Your account was linked, but you are not authorized to view this controlled dataset. Please go ',
          h(Link, {
            href: 'https://dbgap.ncbi.nlm.nih.gov/aa/wga.cgi?page=login',
            ...Utils.newTabLinkProps
          }, [
            'here',
            icon('pop-out', { size: 12 })
          ]),
          ' to check your credentials.'
        ])
      ])
    ])
  }

  const renderStatus = () => {
    const { linkedNihUsername, linkExpireTime, datasetPermissions } = nihStatus
    return div({ style: styles.identityLine }, [
      !linkedNihUsername && h(ShibbolethLink, ['Log in to NIH to link your account']),
      !!linkedNihUsername && div({ style: { display: 'flex', flexDirection: 'column', width: '33rem' } }, [
        div({ style: styles.identityLine }, [
          div({ style: { flex: 1 } }, ['Username:']),
          div({ style: { flex: 2 } }, [linkedNihUsername])
        ]),
        div({ style: styles.identityLine }, [
          div({ style: { flex: 1 } }, ['Link Expiration:']),
          div({ style: { flex: 2 } }, [
            div([Utils.makeCompleteDate(linkExpireTime * 1000)]),
            div({ style: styles.identityLine }, [h(ShibbolethLink, ['Renew'])])
          ])
        ]),
        _.flow(
          _.sortBy('name'),
          _.map(renderDatasetAuthStatus)
        )(datasetPermissions)
      ])
    ])
  }

  const loading = !nihStatus

  /*
   * Render
   */
  return div({ style: { marginBottom: '1rem' } }, [
    div({ style: styles.form.title }, [
      span({ style: { marginRight: '0.5rem', fontWeight: 600 } }, ['NIH Account']),
      h(InfoBox, [
        'Linking with eRA Commons will allow Terra to automatically determine if you can access controlled datasets hosted in Terra (ex. TCGA) based on your valid dbGaP applications.'
      ])
    ]),
    Utils.cond(
      [loading, () => div([spinner(), 'Loading NIH account status...'])],
      [linking, () => div([spinner(), 'Linking NIH account...'])],
      () => renderStatus()
    )
  ])
}


const FenceLink = ({ provider: { key, name, expiresAfter, short } }) => {
  const decodeProvider = state => state ? JSON.parse(atob(state)).provider : ''

  const extractToken = (provider, { state, code }) => {
    const extractedProvider = decodeProvider(state)
    return extractedProvider && provider === extractedProvider ? code : undefined
  }

  const queryParams = qs.parse(window.location.search, { ignoreQueryPrefix: true })
  const token = extractToken(key, queryParams)
  const redirectUrl = `${window.location.origin}/${Nav.getLink('fence-callback')}`

  /*
   * Hooks
   */
  const { fenceStatus: { [key]: { username, issued_at: issuedAt } = {} } } = Utils.useStore(authStore)
  const [isLinking, setIsLinking] = useState(false)
  const signal = Utils.useCancellation()

  const { User } = Ajax(signal)

  const linkFenceAccount = _.flow(
    withErrorReporting('Error linking NIH account'),
    Utils.withBusyState(setIsLinking)
  )(async () => {
    const status = await User.linkFenceAccount(key, token, redirectUrl)
    authStore.update(_.set(['fenceStatus', key], status))
  })

  Utils.useOnMount(() => {
    if (token) {
      const profileLink = `/${Nav.getLink('profile')}`
      window.history.replaceState({}, '', profileLink)
      linkFenceAccount()
    }
  })

  /*
   * Render
   */
  return div({ style: { marginBottom: '1rem' } }, [
    h3({ style: { ...styles.form.title, fontWeight: 600 } }, [name]),
    Utils.cond(
      [isLinking, () => div([spinner(), 'Loading account status...'])],
      [!username, () => div({ style: styles.identityLine },
        [h(FrameworkServiceLink, { linkText: `Log in to link your ${short} account`, provider: key, redirectUrl })]
      )],
      () => div({ style: { display: 'flex', flexDirection: 'column', width: '33rem' } }, [
        div({ style: styles.identityLine }, [
          div({ style: { flex: 1 } }, ['Username:']),
          div({ style: { flex: 2 } }, [username])
        ]),
        div({ style: styles.identityLine }, [
          div({ style: { flex: 1 } }, ['Link Expiration:']),
          div({ style: { flex: 2 } }, [Utils.makeCompleteDate(addDays(expiresAfter, parseJSON(issuedAt)))])
        ]),
        div({ style: styles.identityLine }, [
          h(FrameworkServiceLink, { linkText: 'Renew', 'aria-label': `Renew your ${short} link`, provider: key, redirectUrl }),
          span({ style: { margin: '0 .25rem 0' } }, [' | ']),
          h(UnlinkFenceAccount, { linkText: `Unlink`, 'aria-label': `Unlink from ${short}`, provider: { key, name } })
        ])
      ])
    )
  ])
}


const sectionTitle = text => h2({ style: styles.sectionTitle }, [text])

const Profile = ({ queryParams = {} }) => {
  // State
  const [profileInfo, setProfileInfo] = useState(() => _.mapValues(v => v === 'N/A' ? '' : v, authStore.get().profile))
  const [proxyGroup, setProxyGroup] = useState()
  const [saving, setSaving] = useState()

  const signal = Utils.useCancellation()


  // Helpers
  const assignValue = _.curry((key, value) => {
    setProfileInfo(_.set(key, value))
  })

  const line = children => div({ style: styles.form.line }, children)

  const textField = (key, title, { required } = {}) => h(IdContainer, [id => div({ style: styles.form.container }, [
    required ?
      h(ValidatedInput, {
        inputProps: {
          id,
          value: profileInfo[key],
          onChange: assignValue(key)
        },
        error: Utils.summarizeErrors(errors && errors[key])
      }) :
      h(TextInput, {
        id,
        value: profileInfo[key],
        onChange: assignValue(key)
      })
  ])])

  const radioButton = (key, value) => h(RadioButton, {
    text: value, name: key, checked: profileInfo[key] === value,
    labelStyle: { margin: '0 2rem 0 0.25rem' },
    onChange: () => assignValue(key, value)
  })

  const checkbox = (key, title) => div({ style: styles.form.checkboxLine }, [
    h(LabeledCheckbox, {
      checked: profileInfo[key] === 'true',
      onChange: v => assignValue(key, v.toString())
    }, [span({ style: styles.form.checkboxLabel }, [title])])
  ])


  // Lifecycle
  Utils.useOnMount(() => {
    const loadProxyGroup = async () => {
      setProxyGroup(await Ajax(signal).User.getProxyGroup(authStore.get().profile.email))
    }

    loadProxyGroup()
  })


  // Render
  const { firstName, lastName } = profileInfo
  const required = { presence: { allowEmpty: false } }
  const errors = validate({ firstName, lastName }, { firstName: required, lastName: required })

  return h(FooterWrapper, [
    saving && spinnerOverlay,
    h(TopBar, { title: 'User Profile' }),
    div({ role: 'main', style: { flexGrow: 1 } }, [
      !profileInfo ? centeredSpinner() : h(Fragment, [
        div({ style: { marginLeft: '2rem' } }, [sectionTitle('Profile')]),
        div({ style: styles.header.line }, [
          div({ style: { position: 'relative' } }, [
            profilePic({ size: 48 }),
            h(InfoBox, { style: { alignSelf: 'flex-end' } }, [
              'To change your profile image, visit your ',
              h(Link, {
                href: `https://myaccount.google.com?authuser=${getUser().email}`,
                ...Utils.newTabLinkProps
              }, ['Google account page.'])
            ])
          ]),
          div({ style: styles.header.nameLine }, [
            `Hello again, ${firstName}`
          ])
        ]),
        div({ style: { display: 'flex' } }, [
          div({ style: styles.page }, [
            line([
              textField('firstName', 'First Name', { required: true }),
              textField('lastName', 'Last Name', { required: true })
            ]),
            line([
              textField('title', 'Title')
            ]),
            line([
              div([
                div({ style: styles.form.title }, ['Email']),
                div({ style: { margin: '1rem' } }, [profileInfo.email])
              ]),
              textField('contactEmail', 'Contact Email for Notifications (if different)', { placeholder: profileInfo.email })
            ]),
            line([
              textField('institute', 'Institution'),
              textField('institutionalProgram', 'Institutional Program')
            ]),

            div({ style: styles.form.title }, [
              span({ style: { marginRight: '0.5rem' } }, ['Proxy Group']),
              h(InfoBox, [
                'For more information about proxy groups, see the ',
                h(Link, {
                  href: 'https://support.terra.bio/hc/en-us/articles/360031023592',
                  ...Utils.newTabLinkProps
                }, ['user guide.'])
              ])
            ]),
            div({ style: { margin: '1rem' } }, [proxyGroup]),

            sectionTitle('Program Info'),

            h(IdContainer, [id => div({
              role: 'radiogroup', 'aria-labelledby': id
            }, [
              span({ id, style: styles.form.title }, ['Non-Profit Status']),
              div({ style: { margin: '1rem' } }, [
                radioButton('nonProfitStatus', 'Profit'),
                radioButton('nonProfitStatus', 'Non-Profit')
              ])
            ])]),
            line([
              textField('pi', 'Principal Investigator/Program Lead')
            ]),
            line([
              textField('programLocationCity', 'City'),
              textField('programLocationState', 'State')
            ]),
            line([
              textField('programLocationCountry', 'Country')
            ]),

            sectionTitle('Account Notifications'),

            checkbox('notifications/GroupAccessRequestNotification', 'Group Access Requested'),
            checkbox('notifications/WorkspaceAddedNotification', 'Workspace Access Added'),
            checkbox('notifications/WorkspaceRemovedNotification', 'Workspace Access Removed'),

            h(ButtonPrimary, {
              style: { marginTop: '3rem' },
              onClick: _.flow(
                Utils.withBusyState(setSaving),
                withErrorReporting('Error saving profile')
              )(async () => {
                const [prefsData, profileData] = _.over([_.pickBy, _.omitBy])((v, k) => _.startsWith('notifications/', k), profileInfo)
                await Promise.all([
                  Ajax().User.profile.set(_.pickBy(_.identity, profileData)),
                  Ajax().User.profile.setPreferences(prefsData)
                ])
                await refreshTerraProfile()
              }),
              disabled: !!errors,
              tooltip: !!errors && 'Please fill out all required fields'
            }, ['Save Profile'])
          ]),
          div({ style: { marginTop: '0', marginLeft: '1rem' } }, [
            sectionTitle('Identity & External Servers'),
            h(NihLink, { nihToken: queryParams['nih-username-token'] }),
            _.map(provider => h(FenceLink, { key: provider.key, provider }), allProviders)
          ])
        ])
      ])
    ])
  ])
}

export const navPaths = [
  {
    name: 'profile',
    path: '/profile',
    component: Profile,
    title: 'Profile'
  },
  {
    name: 'fence-callback',
    path: '/fence-callback',
    component: Profile,
    title: 'Profile'
  }
]
