import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
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

export const statusIcon = (status, style) => {
  switch (collapseStatus(status)) {
    case 'succeeded':
      return successIcon(style)
    case 'failed':
      return failedIcon(style)
    case 'running':
      return runningIcon(style)
    default:
      return submittedIcon(style)
  }
}

export const makeStatusLine = (iconFn, text) => div({ style: { display: 'flex', marginTop: '0.5rem', fontSize: 14 } }, [
  iconFn({ marginRight: '0.5rem' }), text
])

export const makeSection = (label, children) => div({
  style: {
    flex: '0 0 33%', padding: '0 0.5rem 0.5rem',
    whiteSpace: 'pre', textOverflow: 'ellipsis', overflow: 'hidden'
  }
}, [
  div({ style: Style.elements.sectionHeader }, label),
  h(Fragment, children)
])

const breadcrumbHistoryCaret = icon('angle-right', { size: 10, style: { margin: '0 0.25rem' } })

export const jobHistoryBreadcrumbPrefix = (namespace, workspaceName) => {
  return h(Fragment, [
    h(Link, {
      href: Nav.getLink('workspace-job-history', { namespace, name: workspaceName })
    }, [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Job History']),
    breadcrumbHistoryCaret
  ])
}

export const submissionDetailsBreadcrumbSubtitle = (namespace, workspaceName, submissionId) => {
  return div({ style: { marginBottom: '1rem', display: 'flex', alignItems: 'center' } }, [
    jobHistoryBreadcrumbPrefix(namespace, workspaceName),
    div({ style: Style.elements.sectionHeader }, [`Submission ${submissionId}`])
  ])
}

export const workflowDetailsBreadcrumbSubtitle = (namespace, workspaceName, submissionId, workflowId) => {
  return div({ style: { marginBottom: '1rem', display: 'flex', alignItems: 'center' } }, [
    jobHistoryBreadcrumbPrefix(namespace, workspaceName),
    h(Link, {
      href: Nav.getLink('workspace-submission-details', { namespace, name: workspaceName, submissionId })
    }, [`Submission ${submissionId}`]),
    breadcrumbHistoryCaret,
    div({ style: Style.elements.sectionHeader }, [`Workflow ${workflowId}`])
  ])
}
