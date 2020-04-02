import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, iframe } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { Link, spinnerOverlay } from 'src/components/common'
import { NewRuntimeModal } from 'src/components/NewRuntimeModal'
import { PeriodicCookieSetter, PlaygroundHeader, RuntimeKicker, RuntimeStatusMonitor, StatusMessage } from 'src/components/runtime-common'
import { Ajax } from 'src/libs/ajax'
import { withErrorReporting } from 'src/libs/error'
import Events from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import * as Utils from 'src/libs/utils'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const AppLauncher = _.flow(
  Utils.forwardRefWithName('AppLauncher'),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: _.get('app')
  })
)(({ namespace, refreshRuntimes, runtime, app }, ref) => {
  const [cookieReady, setCookieReady] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  const runtimeStatus = runtime && runtime.status // preserve null vs undefined
  const runtimeName = runtime?.runtimeName

  return h(Fragment, [
    h(RuntimeStatusMonitor, {
      runtime,
      onRuntimeStartedRunning: async () => {
        await Ajax().Runtimes.notebooks(namespace, runtimeName).setCookie()
        setCookieReady(true)
        Ajax().Metrics.captureEvent(Events.applicationLaunch, { app })
      },
      onRuntimeStoppedRunning: () => setCookieReady(false)
    }),
    h(RuntimeKicker, {
      runtime, refreshRuntimes,
      onNullRuntime: () => setShowCreate(true)
    }),
    runtimeStatus === 'Running' && cookieReady ?
      h(Fragment, [
        h(PeriodicCookieSetter, { namespace, runtimeName }),
        app === 'RStudio' && h(PlaygroundHeader, [
          'This feature is in early development. Your files are saved on your runtime but not to your workspace. We encourage you to frequently ',
          h(Link, {
            href: 'https://support.terra.bio/hc/en-us/articles/360037269472#h_822db925-41fa-4797-b0da-0839580a74da',
            ...Utils.newTabLinkProps
          }, ['back up your files manually']),
          '.'
        ]),
        iframe({
          src: `${runtime.proxyUrl}/${app === 'terminal' ? 'terminals/1' : ''}`,
          style: {
            border: 'none', flex: 1,
            ...(app === 'terminal' ? { marginTop: -45, clipPath: 'inset(45px 0 0)' } : {}) // cuts off the useless Jupyter top bar
          },
          title: `Interactive ${app} iframe`
        })
      ]) :
      div({ style: { padding: '2rem' } }, [
        !busy && h(StatusMessage, { hideSpinner: ['Error', 'Stopped', null].includes(runtimeStatus) }, [
          Utils.switchCase(runtimeStatus,
            ['Creating', () => 'Creating notebook runtime environment. You can navigate away and return in 3-5 minutes.'],
            ['Starting', () => 'Starting notebook runtime environment, this may take up to 2 minutes.'],
            ['Running', () => 'Almost ready...'],
            ['Stopping', () => 'Notebook runtime environment is stopping, which takes ~4 minutes. You can restart it after it finishes.'],
            ['Stopped', () => 'Notebook runtime environment is stopped. Start it to edit your notebook or use the terminal.'],
            ['Error', () => 'Error with the notebook runtime environment, please try again.'],
            [null, () => 'Create a notebook runtime to continue.'],
            [undefined, () => 'Loading...'],
            [Utils.DEFAULT, () => 'Unknown notebook runtime status. Please create a new runtime or contact support.']
          )
        ]),
        h(NewRuntimeModal, {
          isOpen: showCreate,
          namespace, currentRuntime: runtime,
          onDismiss: () => setShowCreate(false),
          onSuccess: _.flow(
            withErrorReporting('Error creating runtime'),
            Utils.withBusyState(setBusy)
          )(async promise => {
            setShowCreate(false)
            await promise
            await refreshRuntimes()
          })
        }),
        busy && spinnerOverlay
      ])
  ])
})


export const navPaths = [
  {
    name: 'workspace-terminal', // legacy
    path: '/workspaces/:namespace/:name/notebooks/terminal',
    component: props => h(Nav.Redirector, { pathname: Nav.getPath('workspace-app-launch', { ...props, app: 'terminal' }) })
  },
  {
    name: 'workspace-app-launch',
    path: '/workspaces/:namespace/:name/applications/:app',
    component: AppLauncher,
    title: ({ name, app }) => `${name} - ${app}`
  }
]
