import _ from 'lodash/fp'
import { Fragment, useRef, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import ReactJson from 'react-json-view'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { Link } from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import { callDetailsBreadcrumbSubtitle, cromwellExecutionStatusIcon, makeSection, makeStatusLine } from 'src/components/job-common'
import { TooltipCell } from 'src/components/table'
import UriViewer from 'src/components/UriViewer'
import { Ajax } from 'src/libs/ajax'
import { bucketBrowserUrl } from 'src/libs/auth'
import colors from 'src/libs/colors'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import CallCacheWizard from 'src/pages/workspaces/workspace/jobHistory/CallCacheWizard'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const naTextDiv = div({ style: { color: colors.dark(0.7), marginTop: '0.5rem' } }, ['N/A'])

const CallDetails = _.flow(
  Utils.forwardRefWithName('CallDetails'),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Job History', activeTab: 'job history'
  })
)((props, ref) => {
  const { namespace, name, submissionId, workflowId, callFqn, index, attempt, workspace: { workspace: { bucketName } } } = props

  /*
   * State setup
   */
  const [callMetadata, setCallMetadata] = useState()
  const [shownUrlFile, setShownUrlFile] = useState()
  const [wizardSelection, setWizardSelection] = useState()
  const [fetchTime, setFetchTime] = useState()

  const signal = Utils.useCancellation()
  const stateRefreshTimer = useRef()

  /*
   * Data fetchers
   */

  Utils.useOnMount(() => {
    const loadWorkflow = async () => {
      const timeBefore = Date.now()
      const initialQueryIncludeKey = [
        'end', 'start', 'status', 'executionStatus', 'backendStatus', 'workflowName', 'callCaching', 'backendLogs', 'inputs', 'outputs', 'stdout', 'stderr', 'callRoot', 'callCaching'
      ]
      const excludeKey = []
      const call = await Ajax(signal).Workspaces.workspace(namespace, name).submission(submissionId).workflow(workflowId).call(callFqn, index, attempt).call_metadata(initialQueryIncludeKey, excludeKey)
      setCallMetadata(call)
      setFetchTime(Date.now() - timeBefore)

      if (call && _.includes(call.status, ['Running', 'Submitted'])) {
        stateRefreshTimer.current = setTimeout(loadWorkflow, 60000)
      }
    }

    loadWorkflow()
    return () => {
      clearTimeout(stateRefreshTimer.current)
    }
  })

  /*
   * Page render
   */
  const {
    start, end, executionStatus, backendStatus, backendLogs: { log: papiLog } = {}, inputs, outputs, stdout, stderr, callRoot,
    callCaching: { result: ccResult, effectiveCallCachingMode } = {}
  } = callMetadata || {}

  const [workflowName, callName] = callFqn.split('.')
  const browserBucketUrl = () => {
    const base = `${bucketName}/${submissionId}/${workflowName}/${workflowId}/call-${callName}`
    const withShard = Number(index) >= 0 ? `${base}/shard-${index}` : base
    const withAttempt = Number(attempt) >= 2 ? `${withShard}/attempt-${attempt}` : withShard
    return withAttempt
  }

  const fileUrlLinks = {
    script: {
      name: 'Evaluated task script',
      url: callRoot && `${callRoot}/script`
    },
    stdout: {
      name: 'Task stdout',
      url: stdout
    },
    stderr: {
      name: 'Task stderr',
      url: stderr
    },
    papiLog: {
      name: 'Cloud execution log',
      url: papiLog
    }
  }

  return div({ style: { padding: '1rem 2rem 2rem', flex: 1, display: 'flex', flexDirection: 'column' } }, [
    callDetailsBreadcrumbSubtitle(namespace, name, submissionId, workflowId, callFqn, index, attempt),
    callMetadata === undefined || div({ style: { fontStyle: 'italic', marginBottom: '1rem' } }, [`Call metadata fetched in ${fetchTime}ms`]),
    callMetadata === undefined ? centeredSpinner() : div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
      makeSection('Call Status', [
        div({ style: { display: 'flex', alignItems: 'center', marginTop: '0.5rem' } }, [
          div({ style: { fontWeight: 'bold' } }, ['Cromwell execution status: ']),
          executionStatus ? makeStatusLine(style => cromwellExecutionStatusIcon(executionStatus, style), executionStatus, { marginLeft: '0.5rem' }) : 'Loading...'
        ]),
        executionStatus === 'Running' && div({ style: { display: 'flex', alignItems: 'center', marginTop: '0.5rem' } }, [
          div({ style: { fontWeight: 'bold' } }, ['Cloud execution status: ']),
          backendStatus ? makeStatusLine(style => cromwellExecutionStatusIcon(executionStatus, style), backendStatus, { marginLeft: '0.5rem' }) : 'Loading...'
        ])
      ]),
      makeSection('Call Timing', [
        div({ style: { display: 'flex', alignItems: 'center', marginTop: '0.5rem' } }, [
          div({ style: { fontWeight: 'bold' } }, ['Start time: ']),
          start ? Utils.makeCompleteDate(start) : 'Loading...'
        ]),
        div({ style: { display: 'flex', alignItems: 'center', marginTop: '0.5rem' } }, [
          div({ style: { fontWeight: 'bold' } }, ['End time: ']),
          end ? Utils.makeCompleteDate(end) : naTextDiv
        ])
      ]),
      makeSection('Links', [
        div({ style: { display: 'flex', flexFlow: 'row wrap' } }, [
          h(Link, {
            ...Utils.newTabLinkProps,
            href: bucketBrowserUrl(browserBucketUrl()),
            style: { display: 'flex', marginLeft: '1rem', marginTop: '0.5rem' }
          }, [icon('folder-open', { size: 18 }), ' Call execution directory']),
          _.map(urlFileLinkKey => {
            const { name, url } = fileUrlLinks[urlFileLinkKey]
            const tooltip = !url && `${name} path is not in the call metadata.`
            return h(Link, {
              onClick: () => setShownUrlFile(urlFileLinkKey),
              disabled: !url,
              tooltip,
              style: { display: 'flex', marginLeft: '1rem', marginTop: '0.5rem' }
            }, [icon('fileAlt', { size: 18 }), ` ${name}`])
          }
          )(_.keys(fileUrlLinks))
        ])
      ]),
      makeSection('Call Inputs', [
        outputs ? div({ style: { height: 200, overflow: 'auto', borderStyle: 'ridge', resize: 'vertical', marginTop: '0.5rem' } }, [
          h(ReactJson, {
            style: { whiteSpace: 'pre-wrap' },
            name: false,
            collapsed: 1,
            enableClipboard: false,
            displayDataTypes: false,
            displayObjectSize: true,
            src: inputs
          })
        ]) : naTextDiv
      ]),
      makeSection('Call Outputs', [
        outputs ? div({ style: { height: 200, overflow: 'auto', borderStyle: 'ridge', resize: 'vertical', marginTop: '0.5rem' } }, [
          h(ReactJson, {
            style: { whiteSpace: 'pre-wrap' },
            name: false,
            collapsed: 1,
            enableClipboard: false,
            displayDataTypes: false,
            displayObjectSize: true,
            src: outputs
          })
        ]) : naTextDiv
      ]),
      makeSection('Call Caching', [
        div({ style: { display: 'flex', flexFlow: 'column' } }, [
          div({ style: { marginTop: '0.5rem', marginRight: '1rem', display: 'flex', alignItems: 'center' } }, [
            div({ style: { fontSize: 15, fontWeight: 'bold' } }, ['Call cache outcome: ']),
            ccResult ? h(Fragment, [
              h(TooltipCell, [ccResult]),
              ccResult === 'Cache Miss' && h(Link, {
                style: { marginLeft: '0.5rem' },
                tooltip: 'Cache Miss Debug Wizard',
                onClick: () => setWizardSelection({ callFqn, index, attempt })
              }, [icon('magic', { size: 18 })])
            ]) : div({ style: { color: colors.dark(0.7) } }, ['No Information'])
          ]),
          div({ style: { marginTop: '0.5rem', marginRight: '1rem', display: 'flex', alignItems: 'center' } }, [
            div({ style: { fontWeight: 'bold' } }, ['Call cache mode: ']),
            effectiveCallCachingMode !== undefined ?
              div({ style: { fontSize: 15, ...Style.codeFont } }, [String(effectiveCallCachingMode)]) :
              div({ style: { color: colors.dark(0.7) } }, ['No Information'])
          ])
        ])
      ]),
      shownUrlFile && h(UriViewer, { googleProject: namespace, uri: fileUrlLinks[shownUrlFile].url, onDismiss: () => setShownUrlFile(undefined) }),
      wizardSelection && h(CallCacheWizard, { onDismiss: () => setWizardSelection(undefined), namespace, name, submissionId, workflowId, ...wizardSelection })
    ])
  ])
})

export const navPaths = [
  {
    name: 'workspace-call-details',
    path: '/workspaces/:namespace/:name/job_history/:submissionId/:workflowId/call/:callFqn/:index/:attempt',
    component: CallDetails,
    title: ({ name }) => `${name} - Call Details`
  }
]
