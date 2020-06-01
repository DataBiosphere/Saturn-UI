import { addDays, differenceInDays, parseJSON } from 'date-fns/fp'
import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { FrameworkServiceLink, ShibbolethLink } from 'src/components/common'
import { Ajax, fetchOk } from 'src/libs/ajax'
import { getConfig } from 'src/libs/config'
import { withErrorReporting } from 'src/libs/error'
import { getAppName } from 'src/libs/logos'
import * as Nav from 'src/libs/nav'
import { clearNotification, notify, sessionTimeoutProps } from 'src/libs/notifications'
import { authStore, pfbImportJobStore, requesterPaysProjectStore, workspacesStore, workspaceStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'


const getAuthInstance = () => {
  return window.gapi.auth2.getAuthInstance()
}

export const signOut = () => {
  sessionStorage.clear()
  getAuthInstance().signOut()
}

export const reloadAuthToken = () => {
  return getAuthInstance().currentUser.get().reloadAuthResponse().catch(() => false)
}

export const hasBillingScope = () => {
  return getAuthInstance().currentUser.get().hasGrantedScopes('https://www.googleapis.com/auth/cloud-billing')
}

/*
 * Request Google Cloud Billing scope if necessary.
 *
 * NOTE: Requesting additional scopes may invoke a browser pop-up which the browser might block.
 * If you use ensureBillingScope during page load and the pop-up is blocked, a rejected promise will
 * be returned. In this case, you'll need to provide something for the user to deliberately click on
 * and retry ensureBillingScope in reaction to the click.
 */
export const ensureBillingScope = async () => {
  if (!hasBillingScope()) {
    const options = new window.gapi.auth2.SigninOptionsBuilder({ scope: 'https://www.googleapis.com/auth/cloud-billing' })
    await getAuthInstance().currentUser.get().grant(options)
    // Wait 250ms before continuing to avoid errors due to delays in applying the new scope grant
    await Utils.delay(250)
  }
}

export const getUser = () => {
  return authStore.get().user
}

export const bucketBrowserUrl = id => {
  return `https://console.cloud.google.com/storage/browser/${id}?authuser=${getUser().email}`
}

export const initializeAuth = _.memoize(async () => {
  await new Promise(resolve => window.gapi.load('auth2', resolve))
  await window.gapi.auth2.init({ clientId: getConfig().googleClientId })
  const processUser = user => {
    return authStore.update(state => {
      const authResponse = user.getAuthResponse(true)
      const profile = user.getBasicProfile()
      const isSignedIn = user.isSignedIn()
      //The following few lines of code are to handle sign-in failures due to privacy tools.
      if (state.isSignedIn === false && isSignedIn === false) {
        //if both of these values are false, it means that the user was initially not signed in (state.isSignedIn === false),
        //tried to sign in (invoking processUser) and was still not signed in (isSignedIn === false).
        notify('error', 'Could not sign in', {
          message: 'Click for more information',
          detail: 'If you are using privacy blockers, they may be preventing you from signing in. Please disable those tools, refresh, and try signing in again.',
          timeout: 30000
        })
      }
      return {
        ...state,
        isSignedIn,
        registrationStatus: isSignedIn ? state.registrationStatus : undefined,
        acceptedTos: isSignedIn ? state.acceptedTos : undefined,
        profile: isSignedIn ? state.profile : {},
        nihStatus: isSignedIn ? state.nihStatus : undefined,
        fenceDCPStatus: isSignedIn ? state.fenceDCPStatus : undefined,
        fenceDCFStatus: isSignedIn ? state.fenceDCFStatus : undefined,
        isTimeoutEnabled: isSignedIn ? state.isTimeoutEnabled : undefined,
        user: {
          token: authResponse && authResponse.access_token,
          id: user.getId(),
          ...(profile ? {
            email: profile.getEmail(),
            name: profile.getName(),
            givenName: profile.getGivenName(),
            familyName: profile.getFamilyName(),
            imageUrl: profile.getImageUrl()
          } : {})
        }
      }
    })
  }
  processUser(getAuthInstance().currentUser.get())
  getAuthInstance().currentUser.listen(processUser)
})

// This is intended for tests to short circuit the login flow
window.forceSignIn = withErrorReporting('Error forcing sign in', async token => {
  const res = await fetchOk(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  authStore.update(state => {
    return {
      ...state,
      isSignedIn: true,
      registrationStatus: undefined,
      isTimeoutEnabled: undefined,
      profile: {},
      user: {
        token,
        id: data.sub,
        email: data.email,
        name: data.name,
        givenName: data.given_name,
        familyName: data.family_name,
        imageUrl: data.picture
      }
    }
  })
})

authStore.subscribe(withErrorReporting('Error checking registration', async (state, oldState) => {
  const getRegistrationStatus = async () => {
    try {
      const { enabled } = await Ajax().User.getStatus()
      return enabled ? 'registered' : 'disabled'
    } catch (error) {
      if (error.status === 404) {
        return 'unregistered'
      } else {
        throw error
      }
    }
  }
  if (!oldState.isSignedIn && state.isSignedIn) {
    clearNotification(sessionTimeoutProps.id)
    const registrationStatus = await getRegistrationStatus()
    authStore.update(state => ({ ...state, registrationStatus }))
  }
}))

authStore.subscribe(withErrorReporting('Error checking TOS', async (state, oldState) => {
  if (!oldState.isSignedIn && state.isSignedIn) {
    const acceptedTos = await Ajax().User.getTosAccepted()
    authStore.update(state => ({ ...state, acceptedTos }))
  }
}))

authStore.subscribe(async (state, oldState) => {
  if (!oldState.acceptedTos && state.acceptedTos) {
    window.Appcues && window.Appcues.identify(state.user.id, {
      dateJoined: parseJSON((await Ajax().User.firstTimestamp()).timestamp).getTime()
    })
  }
})

authStore.subscribe(withErrorReporting('Error checking groups for timeout status', async (state, oldState) => {
  if (oldState.registrationStatus !== 'registered' && state.registrationStatus === 'registered') {
    const isTimeoutEnabled = _.some({ groupName: 'session_timeout' }, await Ajax().Groups.list())
    authStore.update(state => ({ ...state, isTimeoutEnabled }))
  }
}))

/**
 * Developers can get access to a user's ID, so a determined person could compare user IDs to
 * hashes to identify a user in our analytics data. We trust our developers to refrain from
 * doing this.
 */
authStore.subscribe((state, oldState) => {
  if (!oldState.registrationStatus && state.registrationStatus) {
    window.newrelic.setCustomAttribute('userGoogleId', state.user.id)
  }
})

export const refreshTerraProfile = async () => {
  const profile = Utils.kvArrayToObject((await Ajax().User.profile.get()).keyValuePairs)
  authStore.update(state => ({ ...state, profile }))
}

//helpers for external services statuses

const fetchServiceStatus = async statusPromise => {
  try {
    return await statusPromise
  } catch (error) {
    if (error.status === 404) {
      return {}
    } else {
      throw error
    }
  }
}

const fenceNotify = (stateKey, notificationId, serviceName, provider) => (state, oldState) => {
  const status = state[stateKey]
  const oldStatus = oldState[stateKey]
  if (status !== oldStatus) {
    const redirectUrl = `${window.location.origin}/${Nav.getLink('fence-callback')}`
    const now = Date.now()
    const dateOfExpiration = status && addDays(30, parseJSON(status.issued_at))
    const dateFiveDaysBeforeExpiration = dateOfExpiration && addDays(-5, dateOfExpiration)
    const expireStatus = Utils.cond(
      [!dateOfExpiration, () => null],
      [now >= dateOfExpiration, () => 'has expired'],
      [now >= dateFiveDaysBeforeExpiration, () => `will expire in ${differenceInDays(now, dateOfExpiration)} day(s)`]
    )
    if (expireStatus) {
      notify('info', div([
        `Your access to ${serviceName} Framework Services ${expireStatus}. To `,
        expireStatus === 'has expired' ? 'restore ' : 'renew ',
        'access, log-in to Framework Services to ',
        h(FrameworkServiceLink, { linkText: 're-link', provider, redirectUrl }),
        ' your account'
      ]), { id: notificationId })
    } else {
      clearNotification(notificationId)
    }
  }
}

authStore.subscribe(withErrorReporting('Error loading user profile', async (state, oldState) => {
  if (!oldState.isSignedIn && state.isSignedIn) {
    await refreshTerraProfile()
  }
}))

authStore.subscribe(withErrorReporting('Error loading NIH account link status', async (state, oldState) => {
  if (oldState.registrationStatus !== 'registered' && state.registrationStatus === 'registered') {
    const nihStatus = await fetchServiceStatus(Ajax().User.getNihStatus())
    authStore.update(state => ({ ...state, nihStatus }))
  }
}))

authStore.subscribe(async (state, oldState) => {
  if (oldState.registrationStatus !== 'registered' && state.registrationStatus === 'registered') {
    await Ajax().Metrics.syncProfile()
  }
})

authStore.subscribe((state, oldState) => {
  if (state.nihStatus !== oldState.nihStatus) {
    const notificationId = 'nih-link-warning'
    const now = Date.now()
    const expireTime = state.nihStatus && state.nihStatus.linkExpireTime * 1000
    const expireStatus = Utils.cond(
      [!expireTime, () => null],
      [now >= expireTime, () => 'has expired'],
      [now > expireTime - (1000 * 60 * 60 * 24), () => 'will expire soon']
    )
    if (expireStatus) {
      notify('info', `Your access to NIH Controlled Access workspaces and data ${expireStatus}.`, {
        id: notificationId,
        message: h(Fragment, [
          'To regain access, ',
          h(ShibbolethLink, { style: { color: 'unset', fontWeight: 600, textDecoration: 'underline' } }, ['re-link']),
          ` your eRA Commons / NIH account (${state.nihStatus.linkedNihUsername}) with ${getAppName()}.`
        ])
      })
    } else {
      clearNotification(notificationId)
    }
  }
})

authStore.subscribe(withErrorReporting('Error loading DCP Framework Services account status', async (state, oldState) => {
  if (oldState.registrationStatus !== 'registered' && state.registrationStatus === 'registered') {
    const fenceDCPStatus = await fetchServiceStatus(Ajax().User.getFenceStatus('fence'))
    authStore.update(state => ({ ...state, fenceDCPStatus }))
  }
}))

authStore.subscribe(withErrorReporting('Error loading DCF Framework Services account status', async (state, oldState) => {
  if (oldState.registrationStatus !== 'registered' && state.registrationStatus === 'registered') {
    const fenceDCFStatus = await fetchServiceStatus(Ajax().User.getFenceStatus('dcf-fence'))
    authStore.update(state => ({ ...state, fenceDCFStatus }))
  }
}))

//DCP
authStore.subscribe(fenceNotify('fenceDCPStatus', 'fence-dcp-link-warning', 'DCP', 'fence'))


//DCF
authStore.subscribe(fenceNotify('fenceDCFStatus', 'fence-dcf-link-warning', 'DCF', 'dcf-fence'))

authStore.subscribe((state, oldState) => {
  if (oldState.isSignedIn && !state.isSignedIn) {
    workspaceStore.reset()
    workspacesStore.reset()
    pfbImportJobStore.reset()
  }
})

workspaceStore.subscribe((newState, oldState) => {
  const getWorkspaceId = ws => ws && ws.workspace.workspaceId
  if (getWorkspaceId(newState) !== getWorkspaceId(oldState)) {
    requesterPaysProjectStore.reset()
  }
})
