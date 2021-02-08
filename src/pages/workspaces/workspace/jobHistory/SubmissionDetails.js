import _ from 'lodash/fp'
import { Fragment, useEffect, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { ClipboardButton, Link, Select } from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import { DelayedSearchInput } from 'src/components/input'
import {
  collapseStatus, failedIcon, makeSection, makeStatusLine, runningIcon, statusIcon,
  submissionDetailsBreadcrumbSubtitle, submittedIcon, successIcon
} from 'src/components/job-common'
import { FlexTable, Sortable, TextCell, TooltipCell } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { Ajax } from 'src/libs/ajax'
import { bucketBrowserUrl } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import { withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const SubmissionDetails = _.flow(
  Utils.forwardRefWithName('SubmissionDetails'),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Job History', activeTab: 'job history'
  })
)((props, ref) => {
  const { namespace, name, submissionId, workspace: { workspace: { bucketName } } } = props

  /*
   * State setup
   */
  const [submission, setSubmission] = useState({})
  const [methodAccessible, setMethodAccessible] = useState()
  const [statusFilter, setStatusFilter] = useState([])
  const [textFilter, setTextFilter] = useState('')
  const [sort, setSort] = useState({ field: 'workflowEntity', direction: 'asc' })

  const signal = Utils.useCancellation()

  /*
   * Data fetchers
   */

  useEffect(() => {
    const initialize = withErrorReporting('Unable to fetch submission details',
      async () => {
        if (_.isEmpty(submission) || _.some(({ status }) => _.includes(collapseStatus(status), ['running', 'submitted']), submission.workflows)) {
          if (!_.isEmpty(submission)) {
            await Utils.delay(60000)
          }
          const sub = _.update(
            ['workflows'],
            _.map(wf => {
              const {
                cost, inputResolutions, messages, status,
                statusLastChangedDate, workflowEntity: { entityType, entityName } = {}, workflowId
              } = wf

              const wfAsText = _.join(' ', [
                cost, ...messages, status, statusLastChangedDate, entityType, entityName, workflowId,
                ..._.flatMap(({ inputName, value }) => [inputName, JSON.stringify(value)], inputResolutions)
              ]).toLowerCase()

              return _.set('asText', wfAsText, wf)
            }),
            await Ajax(signal).Workspaces.workspace(namespace, name).submission(submissionId).get())

          setSubmission(sub)

          if (_.isEmpty(submission)) {
            try {
              const { methodConfigurationName: configName, methodConfigurationNamespace: configNamespace } = sub
              await Ajax(signal).Workspaces.workspace(namespace, name).methodConfig(configNamespace, configName).get()
              setMethodAccessible(true)
            } catch {
              setMethodAccessible(false)
            }
          }
        }
      })

    initialize()
  }, [submission]) // eslint-disable-line react-hooks/exhaustive-deps


  /*
   * Data prep
   */
  const {
    cost, methodConfigurationName: workflowName, methodConfigurationNamespace: workflowNamespace, submissionDate,
    submissionEntity: { entityType, entityName } = {}, submitter, useCallCache, deleteIntermediateOutputFiles, workflows = []
  } = submission

  const filteredWorkflows = _.flow(
    _.filter(({ status, asText }) => {
      if (_.isEmpty(statusFilter) || statusFilter.includes(status)) {
        return _.every(term => asText.includes(term.toLowerCase()), textFilter.split(/\s+/))
      } else {
        return false
      }
    }),
    _.sortBy(sort.field),
    sort.direction === 'asc' ? _.identity : _.reverse
  )(workflows)

  const { succeeded, failed, running, submitted } = _.groupBy(wf => collapseStatus(wf.status), workflows)
  /*
   * Page render
   */
  return div({ style: { padding: '1rem 2rem 2rem', flex: 1, display: 'flex', flexDirection: 'column' } }, [
    submissionDetailsBreadcrumbSubtitle(namespace, name, submissionId),
    _.isEmpty(submission) ? centeredSpinner() : h(Fragment, [
      div({ style: { display: 'flex' } }, [
        div({ style: { flex: '0 0 200px', marginRight: '2rem', lineHeight: '24px' } }, [
          div({ style: Style.elements.sectionHeader }, 'Workflow Statuses'),
          succeeded && makeStatusLine(successIcon, `Succeeded: ${succeeded.length}`, { marginTop: '0.5rem' }),
          failed && makeStatusLine(failedIcon, `Failed: ${failed.length}`, { marginTop: '0.5rem' }),
          running && makeStatusLine(runningIcon, `Running: ${running.length}`, { marginTop: '0.5rem' }),
          submitted && makeStatusLine(submittedIcon, `Submitted: ${submitted.length}`, { marginTop: '0.5rem' })
        ]),
        div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
          makeSection('Workflow Configuration', [
            Utils.cond(
              [methodAccessible, () => {
                return h(Link, {
                  href: Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName }),
                  style: Style.noWrapEllipsis
                }, [`${workflowNamespace}/${workflowName}`])
              }],
              [methodAccessible === false, () => {
                return div({ style: { display: 'flex', alignItems: 'center' } }, [
                  h(TooltipCell, [`${workflowNamespace}/${workflowName}`]), // TODO fix this width or wrap better
                  h(TooltipTrigger, {
                    content: 'This configuration was updated or deleted since this submission ran.'
                  }, [
                    icon('ban', { size: 16, style: { color: colors.warning(), marginLeft: '0.3rem' } })
                  ])
                ])
              }],
              () => div({ style: Style.noWrapEllipsis }, [`${workflowNamespace}/${workflowName}`])
            )
          ]),
          makeSection('Submitted by', [
            div([submitter]), Utils.makeCompleteDate(submissionDate)
          ]),
          makeSection('Total Run Cost', [cost ? Utils.formatUSD(cost) : 'N/A']),
          makeSection('Data Entity', [div([entityName]), div([entityType])]),
          makeSection('Submission ID', [h(Link,
            { href: bucketBrowserUrl(`${bucketName}/${submissionId}`), ...Utils.newTabLinkProps },
            submissionId
          )]),
          makeSection('Call Caching', [useCallCache ? 'Enabled' : 'Disabled']),
          makeSection('Delete Intermediate Outputs', [deleteIntermediateOutputFiles ? 'Enabled' : 'Disabled'])
        ])
      ]),
      div({ style: { margin: '1rem 0', display: 'flex', alignItems: 'center' } }, [
        h(DelayedSearchInput, {
          style: { marginRight: '2rem', flexBasis: 300, borderColor: colors.dark(0.55) },
          placeholder: 'Search',
          'aria-label': 'Search',
          onChange: setTextFilter,
          value: textFilter
        }),
        div({ style: { flexBasis: 350 } }, [
          h(Select, {
            isClearable: true,
            isMulti: true,
            isSearchable: false,
            placeholder: 'Completion status',
            'aria-label': 'Completion status',
            value: statusFilter,
            onChange: data => setStatusFilter(_.map('value', data)),
            options: Utils.workflowStatuses
          })
        ])
      ]),
      div({ style: { flex: 1 } }, [
        h(AutoSizer, [({ width, height }) => h(FlexTable, {
          width, height,
          rowCount: filteredWorkflows.length,
          noContentMessage: 'No matching workflows',
          columns: [
            {
              size: { basis: 225 },
              headerRenderer: () => h(Sortable, { sort, field: 'workflowEntity', onSort: setSort }, ['Data Entity']),
              cellRenderer: ({ rowIndex }) => {
                const { workflowEntity: { entityName, entityType } = {} } = filteredWorkflows[rowIndex]
                return !!entityName ?
                  h(TooltipCell, [`${entityName} (${entityType})`]) :
                  div({ style: { color: colors.dark(0.7) } }, ['--'])
              }
            }, {
              size: { basis: 225, grow: 0 },
              headerRenderer: () => h(Sortable, { sort, field: 'statusLastChangedDate', onSort: setSort }, ['Last Changed']),
              cellRenderer: ({ rowIndex }) => {
                return h(TextCell, [Utils.makeCompleteDate(filteredWorkflows[rowIndex].statusLastChangedDate)])
              }
            }, {
              size: { basis: 150, grow: 0 },
              headerRenderer: () => h(Sortable, { sort, field: 'status', onSort: setSort }, ['Status']),
              cellRenderer: ({ rowIndex }) => {
                const { status } = filteredWorkflows[rowIndex]
                return div({ style: { display: 'flex' } }, [statusIcon(status, { marginRight: '0.5rem' }), status])
              }
            }, {
              size: { basis: 125, grow: 0 },
              headerRenderer: () => h(Sortable, { sort, field: 'cost', onSort: setSort }, ['Run Cost']),
              cellRenderer: ({ rowIndex }) => {
                // handle undefined workflow cost as $0
                return cost ? h(TextCell, [Utils.formatUSD(filteredWorkflows[rowIndex].cost || 0)]) : 'N/A'
              }
            }, {
              size: _.some(({ messages }) => !_.isEmpty(messages), filteredWorkflows) ? { basis: 200 } : { basis: 100, grow: 0 },
              headerRenderer: () => h(Sortable, { sort, field: 'messages', onSort: setSort }, ['Messages']),
              cellRenderer: ({ rowIndex }) => {
                const messages = _.join('\n', filteredWorkflows[rowIndex].messages)
                return h(TooltipCell, {
                  tooltip: div({ style: { whiteSpace: 'pre-wrap', overflowWrap: 'break-word' } }, [messages])
                }, [messages])
              }
            }, {
              size: { basis: 150 },
              headerRenderer: () => h(Sortable, { sort, field: 'workflowId', onSort: setSort }, ['Workflow ID']),
              cellRenderer: ({ rowIndex }) => {
                const { workflowId } = filteredWorkflows[rowIndex]
                return workflowId && h(Fragment, [
                  h(TooltipCell, { tooltip: workflowId }, [workflowId]),
                  h(ClipboardButton, { text: workflowId, style: { marginLeft: '0.5rem' } })
                ])
              }
            }, {
              size: { basis: 150, grow: 0 },
              headerRenderer: () => 'Links',
              cellRenderer: ({ rowIndex }) => {
                const { workflowId, inputResolutions: [{ inputName } = {}] } = filteredWorkflows[rowIndex]
                return workflowId && h(Fragment, [
                  h(Link, {
                    ...Utils.newTabLinkProps,
                    href: `${getConfig().jobManagerUrlRoot}/${workflowId}`,
                    style: { padding: '.6rem', display: 'flex' },
                    tooltip: 'Job Manager',
                    'aria-label': 'Job Manager'
                  }, [icon('tasks', { size: 18 })]),
                  h(Link, {
                    href: Nav.getLink('workspace-workflow-dashboard', { namespace, name, submissionId, workflowId }),
                    style: { padding: '.6rem', display: 'flex' },
                    tooltip: 'Workflow Dashboard [alpha]',
                    'aria-label': 'Workflow Dashboard [alpha]'
                  }, [icon('tachometer', { size: 18 })]),
                  inputName && h(Link, {
                    ...Utils.newTabLinkProps,
                    href: bucketBrowserUrl(`${bucketName}/${submissionId}/${inputName.split('.')[0]}/${workflowId}`),
                    style: { padding: '.6rem', display: 'flex' },
                    tooltip: 'Execution directory',
                    'aria-label': 'Execution directory'
                  }, [icon('folder-open', { size: 18 })])
                ])
              }
            }
          ]
        })])
      ])
    ])
  ])
})

export const navPaths = [
  {
    name: 'workspace-submission-details',
    path: '/workspaces/:namespace/:name/job_history/:submissionId',
    component: SubmissionDetails,
    title: ({ name }) => `${name} - Submission Details`
  }
]
