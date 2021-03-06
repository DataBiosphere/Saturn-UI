import 'src/libs/routes'

import { hot } from 'react-hot-loader/root'
import { h } from 'react-hyperscript-helpers'
import ReactNotification from 'react-notifications-component'
import AuthContainer from 'src/components/AuthContainer'
import ConfigOverridesWarning from 'src/components/ConfigOverridesWarning'
import CookieWarning from 'src/components/CookieWarning'
import ErrorWrapper from 'src/components/ErrorWrapper'
import Favicon from 'src/components/Favicon'
import FirecloudNotification from 'src/components/FirecloudNotification'
import IdleStatusMonitor from 'src/components/IdleStatusMonitor'
import ImportStatus from 'src/components/ImportStatus'
import NpsSurvey from 'src/components/NpsSurvey'
import { AuthenticatedCookieSetter } from 'src/components/runtime-common'
import ServiceAlerts from 'src/components/ServiceAlerts'
import SupportRequest from 'src/components/SupportRequest'
import { PageViewReporter } from 'src/libs/events'
import { LocationProvider, Router, TitleManager } from 'src/libs/nav'


const Main = () => {
  return h(LocationProvider, [
    h(CookieWarning),
    h(ReactNotification),
    h(ImportStatus),
    h(ServiceAlerts),
    h(Favicon),
    h(IdleStatusMonitor),
    h(ErrorWrapper, [
      h(TitleManager),
      h(FirecloudNotification),
      h(AuthenticatedCookieSetter),
      h(AuthContainer, [h(Router)])
    ]),
    h(PageViewReporter),
    h(SupportRequest),
    h(NpsSurvey),
    h(ConfigOverridesWarning)
  ])
}

export default hot(Main)
