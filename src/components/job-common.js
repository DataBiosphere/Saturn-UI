import { Fragment } from 'react'
import { div, h, span } from 'react-hyperscript-helpers'
import { Link } from 'src/components/common'
import { icon } from 'src/components/icons'
import colors from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'


export const collapseStatus = status => {
  switch (status) {
    case 'Succeeded':
      return 'succeeded'
    case 'Aborting': // only on submissions not workflows
    case 'Aborted':
    case 'Failed':
      return 'failed'
    case 'Running':
      return 'running'
    default:
      return 'submitted'
  }
}


export const collapseCromwellExecutionStatus = status => {
  switch (status) {
    case 'Done':
      return 'succeeded'
    case 'Aborting':
    case 'Aborted':
    case 'Failed':
      return 'failed'
    case 'Running':
      return 'running'
    case 'Submitted':
      return 'submitted'
    default:
      return `Unexpected status (${status})`
  }
}

const size = 24

export const successIcon = style => icon('check', { size, style: { color: colors.success(), ...style } })
export const failedIcon = style => icon('warning-standard', { size, style: { color: colors.danger(), ...style } })
export const runningIcon = style => icon('sync', { size, style: { color: colors.dark(), ...style } })
export const submittedIcon = style => icon('clock', { size, style: { color: colors.dark(), ...style } })
export const unknownIcon = style => icon('question', { size, style: { color: colors.dark(), ...style } })

export const statusIcon = (status, style, collapseFunction = collapseStatus) => {
  switch (collapseFunction(status)) {
    case 'succeeded':
      return successIcon(style)
    case 'failed':
      return failedIcon(style)
    case 'running':
      return runningIcon(style)
    case 'submitted':
      return submittedIcon(style)
    default:
      return unknownIcon(style)
  }
}

export const cromwellExecutionStatusIcon = (status, style) => statusIcon(status, style, collapseCromwellExecutionStatus)

export const makeStatusLine = (iconFn, text, style) => div({ style: { display: 'flex', alignItems: 'center', fontSize: 14, textTransform: 'capitalize', ...style } }, [
  iconFn({ marginRight: '0.5rem' }), text
])

export const makeCromwellStatusLine = cromwellStatus => {
  const collapsedStatus = collapseCromwellExecutionStatus(cromwellStatus)
  return makeStatusLine(style => cromwellExecutionStatusIcon(cromwellStatus, style), collapsedStatus, { marginLeft: '0.5rem' })
}

export const makeSection = (label, children) => div({
  style: {
    flex: '0 0 33%', padding: '0 0.5rem 0.5rem', marginTop: '1rem',
    whiteSpace: 'pre', textOverflow: 'ellipsis', overflow: 'hidden'
  }
}, [
  div({ style: Style.elements.sectionHeader }, label),
  h(Fragment, children)
])

export const breadcrumbHistoryCaret = icon('angle-right', { size: 10, style: { margin: '0 0.25rem' } })

export const jobHistoryBreadcrumbPrefix = (namespace, workspaceName) => {
  return h(Fragment, [
    h(Link, {
      href: Nav.getLink('workspace-job-history', { namespace, name: workspaceName })
    }, [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Job History']),
    breadcrumbHistoryCaret
  ])
}

const breadcrumbLink = (title, link) => [
  h(Link, {
    href: link
  }, [title]),
  breadcrumbHistoryCaret
]

const breadcrumbPageTitle = title => div({ style: Style.elements.sectionHeader }, [title])

const breadcrumbSubtitleStyle = { marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }

export const submissionDetailsBreadcrumbSubtitle = (namespace, workspaceName, submissionId) => {
  return div({ style: breadcrumbSubtitleStyle }, [
    jobHistoryBreadcrumbPrefix(namespace, workspaceName),
    breadcrumbPageTitle(`Submission ${submissionId}`)
  ])
}

export const workflowDetailsBreadcrumbSubtitle = (namespace, workspaceName, submissionId, workflowId) => {
  return div({ style: breadcrumbSubtitleStyle }, [
    jobHistoryBreadcrumbPrefix(namespace, workspaceName),
    breadcrumbLink(`Submission ${submissionId}`, Nav.getLink('workspace-submission-details', { namespace, name: workspaceName, submissionId })),
    breadcrumbPageTitle(`Workflow ${workflowId}`)
  ])
}

export const callDetailsBreadcrumbSubtitle = (namespace, workspaceName, submissionId, workflowId, callFqn, index, attempt) => {
  return div({ style: breadcrumbSubtitleStyle }, [
    jobHistoryBreadcrumbPrefix(namespace, workspaceName),
    breadcrumbLink(`Submission ${submissionId}`, Nav.getLink('workspace-submission-details', { namespace, name: workspaceName, submissionId })),
    breadcrumbLink(`Workflow ${workflowId}`, Nav.getLink('workspace-workflow-dashboard', { namespace, name: workspaceName, submissionId, workflowId })),
    breadcrumbPageTitle(['Call ', span({ style: Style.codeFont }, [callFqn])]),
    index !== '-1' ? [breadcrumbHistoryCaret, breadcrumbPageTitle(`index ${index}`)] : [],
    Number(attempt) > 1 ? [breadcrumbHistoryCaret, breadcrumbPageTitle(`attempt ${attempt}`)] : []
  ])
}
