import * as clipboard from 'clipboard-polyfill/text'
import _ from 'lodash/fp'
import { useEffect, useState } from 'react'
import { div, h, li, table, tbody, td, tr, ul } from 'react-hyperscript-helpers'
import ReactJson from 'react-json-view'
import * as breadcrumbs from 'src/components/breadcrumbs'
import Collapse from 'src/components/Collapse'
import { Link } from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import {
  collapseCromwellExecutionStatus,
  collapseStatus,
  failedIcon,
  makeSection,
  makeStatusLine,
  runningIcon,
  statusIcon, submittedIcon,
  successIcon, unknownIcon
} from 'src/components/job-common'
import TooltipTrigger from 'src/components/TooltipTrigger'
import UriViewer from 'src/components/UriViewer'
import WDLViewer from 'src/components/WDLViewer'
import { Ajax } from 'src/libs/ajax'
import { bucketBrowserUrl } from 'src/libs/auth'
import { getConfig } from 'src/libs/config'
import { withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const styles = {
  sectionTableLabel: { paddingRight: '0.6rem', fontWeight: 600 }
}

const groupCallStatuses = callsObject => {
  const statusCounts = {}
  for (const callname in callsObject) {
    for (const attempt in callsObject[callname]) {
      const executionStatus = collapseCromwellExecutionStatus(callsObject[callname][attempt].executionStatus)
      statusCounts[executionStatus] = (statusCounts[executionStatus] || 0) + 1
    }
  }
  return statusCounts
}

const statusCell = workflowObject => {
  const { succeeded, failed, running, submitted, ...others } = groupCallStatuses(workflowObject.calls)
  console.log(others)

  return div([
    table({ style: { margin: '0.5rem' } }, [
      tbody({}, [
        submitted ? tr({}, [
          td(styles.statusDetailCell, [submittedIcon()]),
          td(['Submitted']),
          td(styles.statusDetailCell, [submitted])
        ]) : undefined,
        running ? tr({}, [
          td(styles.statusDetailCell, [runningIcon()]),
          td(['Running']),
          td(styles.statusDetailCell, [running])
        ]): undefined,
        succeeded ? tr({}, [
          td(styles.statusDetailCell, [successIcon()]),
          td(['Succeeded']),
          td(styles.statusDetailCell, [succeeded])
        ]): undefined,
        failed ? tr({}, [
          td(styles.statusDetailCell, [failedIcon()]),
          td(['Failed']),
          td(styles.statusDetailCell, [failed])
        ]): undefined,
        _.map(other => tr({}, [
          td(styles.statusDetailCell, [unknownIcon()]),
          td([other]),
          td(styles.statusDetailCell, [others[other]])
        ]), Object.keys(others))
      ].filter(element => element !== undefined))
    ])

  ])
}

const WorkflowDashboard = _.flow(
  Utils.forwardRefWithName('WorkflowDashboard'),
  wrapWorkspace({
    breadcrumbs: props => [
      ...breadcrumbs.commonPaths.workspaceJobHistory(props),
      breadcrumbs.breadcrumbElement(`submission ${props.submissionId}`, Nav.getLink('workspace-submission-details', props))
    ],
    title: props => `Workflow ${props.workflowId}`, activeTab: 'job history'
  })
)((props, ref) => {
  const { namespace, name, submissionId, workflowId, workspace: { workspace: { bucketName } } } = props

  /*
   * State setup
   */
  const [workflow, setWorkflow] = useState({})
  const [rootCopied, setRootCopied] = useState()
  const [showLog, setShowLog] = useState(false)
  const [failureCopied, setFailureCopied] = useState()

  const signal = Utils.useCancellation()

  /*
   * Data fetchers
   */

  useEffect(() => {
    const initialize = withErrorReporting('Unable to fetch Workflow Details',
      async () => {
        // If the workflow is empty, or we need to refresh after 60s:
        if (_.isEmpty(workflow) || _.includes(workflow.status, ['Running', 'Submitted'])) {
          if (!_.isEmpty(workflow)) {
            await Utils.delay(60000)
          }
          const includeKey = [
            'backendLogs',
            'backendStatus',
            'end',
            'executionStatus',
            'callCaching:hit',
            'failures',
            'id',
            'jobId',
            'start',
            'status',
            'stderr',
            'stdout',
            'submission',
            'submittedFiles:workflow',
            'subworkflowId',
            'workflowLog',
            'workflowName',
            'workflowRoot'
          ]
          const wf = await Ajax(signal).Workspaces.workspace(namespace, name).submission(submissionId).getWorkflow(workflowId, includeKey)
          setWorkflow(wf)
        }
      })

    initialize()
  }, [workflow]) // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * Page render
   */
  const {
    end,
    failures,
    start,
    status,
    workflowLog,
    workflowName,
    workflowRoot,
    submittedFiles: { workflow: wdl } = {}
  } = workflow

  const restructureFailures = _.map(({ message, causedBy }) => ({
    message,
    ...(!_.isEmpty(causedBy) ? { causedBy: simplifyDidNotStartFailures(restructureFailures(causedBy)) } : {})
  }))

  const simplifyDidNotStartFailures = failuresArray => {
    const filtered = _.filter(({ message }) => !_.isEmpty(message) && !message.startsWith('Will not start job'), failuresArray)
    const sizeDiff = !_.isEmpty(failuresArray) ? failuresArray.length - filtered.length : 0
    const newMessage = sizeDiff > 0 ? [{ message: `${sizeDiff} jobs were queued in Cromwell but never sent to the cloud backend due to failures elsewhere in the workflow` }]: []

    return [...filtered, ...newMessage]
  }

  return div({ style: { padding: '1rem 2rem 2rem', flex: 1, display: 'flex', flexDirection: 'column' } }, [
    h(Link, {
      href: Nav.getLink('workspace-submission-details', { namespace, name, submissionId }),
      style: { alignSelf: 'flex-start', display: 'flex', alignItems: 'center', padding: '0.5rem 0' }
    }, [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Back to submission']),
    _.isEmpty(workflow) ? centeredSpinner() : div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
      makeSection('Workflow Status', [
        div({ style: { lineHeight: '24px' } }, [makeStatusLine(style => statusIcon(status, style), status)])
      ]),
      makeSection('Workflow Timing', [
        table({ style: { marginTop: '0.3rem', lineHeight: '20px' } }, [
          tbody([
            tr([td({ style: styles.sectionTableLabel }, ['Start:']), start ? td([Utils.makeCompleteDate(start)]) : 'N/A']),
            tr([td({ style: styles.sectionTableLabel }, ['End:']), end ? td([Utils.makeCompleteDate(end)]) : 'N/A'])
          ])
        ])
      ]),
      makeSection('Workflow Storage', [
        div({ style: { display: 'flex' } }, [
          h(Link, {
            ...Utils.newTabLinkProps,
            style: Style.noWrapEllipsis,
            href: bucketBrowserUrl(`${bucketName}/${submissionId}/${workflowName}/${workflowId}`),
            tooltip: 'Open in Google Cloud Storage Browser'
          }, [workflowRoot]),
          h(Link, {
            style: { margin: '0 0.5rem' },
            tooltip: 'Copy gs:// URI to clipboard',
            onClick: withErrorReporting('Error copying to clipboard', async () => {
              await clipboard.writeText(workflowRoot)
              setRootCopied(true)
              await Utils.delay(1500)
              setRootCopied(undefined)
            })
          }, [icon(rootCopied ? 'check' : 'copy-to-clipboard')])
        ]),
        div({ style: { marginTop: '1rem' } }, [
          h(Link, { onClick: () => setShowLog(true) }, ['View execution log'])
        ])
      ]),
      makeSection('Job Manager', [
        div({ style: { display: 'flex' } }, [
          div(['This workflow can also be viewed in:',
            ul([li([
              h(Link, {
                ...Utils.newTabLinkProps,
                href: `${getConfig().jobManagerUrlRoot}/${workflowId}`,
                style: { flexGrow: 1, textAlign: 'left' }
              }, [div({ style: { display: 'flex', alignItems: 'center' } }, [
                div({ style: { flex: 'none', display: 'flex', width: '0.3rem' } }, [
                  icon('folder', { size: 18 })
                ]),
                div({ style: { flex: 1, paddingLeft: '1rem' } }, ['Job Manager'])
              ])]
              )
            ])])])
        ])
      ]),
      makeSection('Call Statuses', [
        div({ style: { display: 'flex' } }, [statusCell(workflow)])
      ])
    ]),
    failures && h(Collapse, {
      style: { marginBottom: '1rem' },
      initialOpenState: true,
      title: div({ style: Style.elements.sectionHeader }, [
        'Workflow-Level Failures',
        h(Link, {
          style: { margin: '0 0.5rem' },
          tooltip: 'Copy failures to clipboard',
          onClick: withErrorReporting('Error copying to clipboard', async e => {
            e.stopPropagation() // this stops the collapse when copying
            await clipboard.writeText(JSON.stringify(failures, null, 2))
            setFailureCopied(true)
            await Utils.delay(1500)
            setFailureCopied(undefined)
          })
        }, [icon(failureCopied ? 'check' : 'copy-to-clipboard')])
      ])
    }, [h(ReactJson, {
      style: { whiteSpace: 'pre-wrap' },
      name: false,
      collapsed: 4,
      enableClipboard: false,
      displayDataTypes: false,
      displayObjectSize: false,
      src: simplifyDidNotStartFailures(restructureFailures(failures))
    })]),
    wdl && h(Collapse, {
      title: div({ style: Style.elements.sectionHeader }, ['Submitted workflow script'])
    }, [h(WDLViewer, { wdl })]),
    showLog && h(UriViewer, { googleProject: namespace, uri: workflowLog, onDismiss: () => setShowLog(false) })
  ])
})

export const navPaths = [
  {
    name: 'workspace-workflow-dashboard',
    path: '/workspaces/:namespace/:name/job_history/:submissionId/:workflowId',
    component: WorkflowDashboard,
    title: ({ name }) => `${name} - Workflow Dashboard`
  }
]

