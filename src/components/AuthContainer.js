import _ from 'lodash/fp'
import { h } from 'react-hyperscript-helpers'
import { centeredSpinner } from 'src/components/icons'
import { useRoute } from 'src/libs/nav'
import { authStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import { Disabled } from 'src/pages/Disabled'
import Register from 'src/pages/Register'
import SignIn from 'src/pages/SignIn'
import TermsOfService from 'src/pages/TermsOfService'
import DashboardPublic from 'src/pages/workspaces/workspace/DashboardPublic'


const AuthContainer = ({ children }) => {
  const { name, params, public: isPublic } = useRoute()
  const { isSignedIn, registrationStatus, acceptedTos, profile } = Utils.useStore(authStore)
  const authspinner = () => h(centeredSpinner, { style: { position: 'fixed' } })

  return Utils.cond(
    [isSignedIn === undefined && !isPublic, authspinner],
    [isSignedIn === false && name === 'workspace-dashboard', () => h(DashboardPublic, params)],
    [isSignedIn === false && !isPublic, () => h(SignIn)],
    [registrationStatus === undefined && !isPublic, authspinner],
    [registrationStatus === 'unregistered', () => h(Register)],
    [registrationStatus === 'disabled', () => h(Disabled)],
    [acceptedTos === undefined && !isPublic, authspinner],
    [acceptedTos === false && name !== 'privacy', () => h(TermsOfService)],
    [_.isEmpty(profile) && !isPublic, authspinner],
    () => children
  )
}

export default AuthContainer
