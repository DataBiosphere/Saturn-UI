import _ from 'lodash/fp'
import { forwardRef, Fragment, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { buttonPrimary, link, Select } from 'src/components/common'
import { centeredSpinner } from 'src/components/icons'
import { textInput } from 'src/components/input'
import { collapseStatus, failedIcon, runningIcon, successIcon } from 'src/components/job-common'
import Modal from 'src/components/Modal'
import { FlexTable } from 'src/components/table'
import { ajaxCaller } from 'src/libs/ajax'
import { bucketBrowserUrl } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const SubmissionDetails = _.flow(
  forwardRef,
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Job History', activeTab: 'job history'
  }),
  ajaxCaller
)((props, ref) => {
  const { namespace, name, submissionId, ajax: { Workspaces }, workspace: { workspace: { bucketName, workflowCollectionName } } } = props

  const [submission, setSubmission] = useState({})
  const [statusFilter, setStatusFilter] = useState()
  const [textFilter, setTextFilter] = useState()
  const [linkToFC, setLinkToFC] = useState()

  Utils.useOnMount(() => { Workspaces.workspace(namespace, name).submission(submissionId).get().then(setSubmission) })

  const {
    cost, methodConfigurationName: workflowName, methodConfigurationNamespace: workflowNamespace, submissionDate,
    submissionEntity: { entityType, entityName } = {}, submitter, useCallCache, workflows
  } = submission


  const makeStatusLine = (iconFn, text) => div({ style: { display: 'flex', marginTop: '0.5rem', fontSize: 14 } }, [
    iconFn({ marginRight: '0.5rem' }), text
  ])

  const makeSection = (label, children) => div({ style: { flexBasis: '33%', marginBottom: '1rem' } }, [
    div({ style: Style.elements.sectionHeader }, label),
    h(Fragment, children)
  ])

  const { succeeded, failed, running } = _.groupBy(wf => collapseStatus(wf.status), workflows)

  return _.isEmpty(submission) ? centeredSpinner() : div({ style: { padding: '2rem' } }, [
    div({ style: { display: 'flex' } }, [
      div({ style: { flexBasis: 200, marginRight: '2rem', lineHeight: '24px' } }, [
        div({ style: Style.elements.sectionHeader }, 'Workflow Statuses'),
        succeeded && makeStatusLine(successIcon, `Succeeded: ${succeeded.length}`),
        failed && makeStatusLine(failedIcon, `Failed: ${failed.length}`),
        running && makeStatusLine(runningIcon(), `Running: ${running.length}`)
      ]),
      div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
        makeSection('Workflow Configuration', [link(
          { href: Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName }) },
          [`${workflowNamespace}/${workflowName}`]
        )]),
        makeSection('Submitted by', [
          div([submitter]), Utils.makeCompleteDate(submissionDate)
        ]),
        makeSection('Total Run Cost', [`$${cost.toPrecision(3)}`]),
        makeSection('Data Entity', [`${entityName} (${entityType})`]),
        makeSection('Submission ID', [link(
          { href: bucketBrowserUrl(`${bucketName}/${submissionId}`), target: '_blank' },
          submissionId
        )]),
        makeSection('Call Caching', [useCallCache ? 'Enabled' : 'Disabled'])
      ])
    ]),
    div({ style: { margin: '1rem 0', display: 'flex' } }, [
      textInput({
        style: { marginRight: '2rem', flexBasis: 300, borderColor: colors.gray[3] },
        placeholder: 'Filter',
        onChange: ({ target: { value } }) => setTextFilter(value),
        value: textFilter
      }),
      div({ style: { flexBasis: 350 } }, [
        h(Select, {
          isClearable: true,
          isMulti: true,
          isSearchable: false,
          placeholder: 'Completion status',
          value: statusFilter,
          onChange: data => setStatusFilter(_.map('value', data)),
          options: Utils.workflowStatuses
        })
      ])
    ]),
    h(AutoSizer, [({ width, height }) => h(FlexTable, {
      width, height,
      rowCount: workflows.length,
      columns: [
        {
          size: { basis: 80, grow: 0 },
          headerRenderer: () => {},
          cellRenderer: ({ rowIndex }) => {
            const { workflowId } = workflows[rowIndex]
            return link(!!workflowCollectionName ? {
              target: '_blank',
              href: `${getConfig().jobManagerUrlRoot}/${workflowId}`
            } : {
              onClick: () => setLinkToFC(`${getConfig().firecloudUrlRoot}/#workspaces/${namespace}/${name}/monitor/${submissionId}/${workflowId}`)
            }, 'View')
          }
        }
        // {
        //   size: { basis: 250, grow: 0 },
        //   headerRenderer: () => h(HeaderCell, ['Data entity']),
        //   cellRenderer: ({ rowIndex }) => {
        //     const { submissionEntity: { entityName, entityType } } = submissions[rowIndex]
        //     const text = `${entityName} (${entityType})`
        //     return h(TooltipTrigger, { content: text }, [h(TextCell, text)])
        //   }
        // },
        // {
        //   size: { basis: 175, grow: 0 },
        //   headerRenderer: () => h(HeaderCell, ['No. of Workflows']),
        //   cellRenderer: ({ rowIndex }) => {
        //     const { workflowStatuses } = submissions[rowIndex]
        //     return h(TextCell, Utils.formatNumber(_.sum(_.values(workflowStatuses))))
        //   }
        // },
        // {
        //   size: { basis: 150, grow: 0 },
        //   headerRenderer: () => h(HeaderCell, ['Status']),
        //   cellRenderer: ({ rowIndex }) => {
        //     const {
        //       methodConfigurationNamespace, methodConfigurationName, submissionId, workflowStatuses,
        //       status, submissionEntity
        //     } = submissions[rowIndex]
        //     return h(Fragment, [
        //       statusCell(workflowStatuses), status === 'Aborting' && 'Aborting',
        //       (collapsedStatuses(workflowStatuses).running && status !== 'Aborting') && h(TooltipTrigger, {
        //         content: 'Abort all workflows'
        //       }, [
        //         h(Clickable, {
        //           onClick: () => this.setState({ aborting: submissionId })
        //         }, [
        //           icon('times-circle', { size: 20, style: { color: colors.green[0], marginLeft: '0.5rem' } })
        //         ])
        //       ]),
        //       isTerminal(status) && workflowStatuses['Failed'] &&
        //       submissionEntity && h(TooltipTrigger, {
        //         content: 'Re-run failures'
        //       }, [
        //         h(Clickable, {
        //           onClick: () => rerunFailures({
        //             namespace,
        //             name,
        //             submissionId,
        //             configNamespace: methodConfigurationNamespace,
        //             configName: methodConfigurationName,
        //             onDone: () => this.refresh()
        //           })
        //         }, [
        //           icon('sync', { size: 18, style: { color: colors.green[0], marginLeft: '0.5rem' } })
        //         ])
        //       ])
        //     ])
        //   }
        // },
        // {
        //   size: { basis: 150, grow: 1 },
        //   headerRenderer: () => h(HeaderCell, ['Submitted']),
        //   cellRenderer: ({ rowIndex }) => {
        //     const { submissionDate } = submissions[rowIndex]
        //     return h(TooltipTrigger, { content: Utils.makeCompleteDate(submissionDate) }, [
        //       h(TextCell, Utils.makePrettyDate(submissionDate))
        //     ])
        //   }
        // }
      ]
    })]),
    linkToFC && h(Modal, {
      onDismiss: () => setLinkToFC(undefined),
      title: 'Legacy Workflow Details',
      okButton: buttonPrimary({
        as: 'a',
        href: linkToFC,
        target: '_blank',
        onClick: () => setLinkToFC(undefined)
      }, 'Go To FireCloud')
    }, [
      `We are currently introducing Terra's new job management component for accessing workflow details. However, this
        workspace isn't yet ready to use the new job manager. For now, workflow details can be found in our legacy system,
        FireCloud. You will be asked to sign in to FireCloud to view your workflow details.`
    ])
  ])


  /*!!workflowCollectionName ? {
   target: '_blank',
   href: `${getConfig().jobManagerUrlRoot}?q=submission-id%3D${submissionId}`
   } : {
   onClick: () => this.setState({
   linkToFC: `${getConfig().firecloudUrlRoot}/#workspaces/${namespace}/${name}/monitor/${submissionId}/${workflowId}`
   })
   }*/
})

export const addNavPaths = () => {
  Nav.defPath('workspace-submission-details', {
    path: '/workspaces/:namespace/:name/job_history/:submissionId',
    component: SubmissionDetails,
    title: ({ name }) => `${name} - Submission Details`
  })
}
