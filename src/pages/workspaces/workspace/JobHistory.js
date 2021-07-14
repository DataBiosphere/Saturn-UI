import _ from 'lodash/fp'
import { Fragment, useImperativeHandle, useRef, useState } from 'react'
import { div, h, span, table, tbody, td, tr } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { ButtonPrimary, Clickable, HeaderRenderer, Link, spinnerOverlay } from 'src/components/common'
import { DelayedSearchInput } from 'src/components/input'
import { collapseStatus, failedIcon, runningIcon, submittedIcon, successIcon } from 'src/components/job-common'
import Modal from 'src/components/Modal'
import { FlexTable, TextCell, TooltipCell } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { Ajax } from 'src/libs/ajax'
import { bucketBrowserUrl } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { rerunFailures } from 'src/pages/workspaces/workspace/workflows/FailureRerunner'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const styles = {
  submissionsTable: {
    padding: '1rem', flex: 1
  },
  deemphasized: {
    fontWeight: 'initial'
  },
  statusDetailCell: {
    align: 'center',
    style: { padding: '0.5rem' }
  }
}


const isTerminal = submissionStatus => submissionStatus === 'Aborted' || submissionStatus === 'Done'


const collapsedStatuses = _.flow(
  _.toPairs,
  _.map(([status, count]) => ({ [collapseStatus(status)]: count })),
  _.reduce(_.mergeWith(_.add), {})
)

const statusCell = (workflowStatuses, status) => {
  const statuses = collapsedStatuses(workflowStatuses)
  const { succeeded, failed, running, submitted } = statuses

  const summary = _.flow(
    _.toPairs,
    _.map(([status, count]) => `${count} ${status}`),
    _.join(', ')
  )(statuses)

  return h(TooltipTrigger, {
    side: 'bottom',
    type: 'light',
    content: table({ style: { margin: '0.5rem' } }, [
      tbody({}, [
        tr({}, [
          td(styles.statusDetailCell, [successIcon()]),
          td(styles.statusDetailCell, [failedIcon()]),
          td(styles.statusDetailCell, [runningIcon()]),
          td(styles.statusDetailCell, [submittedIcon()])
        ]),
        tr({}, [
          td(styles.statusDetailCell, [succeeded || 0]),
          td(styles.statusDetailCell, [failed || 0]),
          td(styles.statusDetailCell, [running || 0]),
          td(styles.statusDetailCell, [submitted || 0])
        ])
      ])
    ])
  }, [
    div({ style: { display: 'flex', alignItems: 'center' } }, [
      span({
        tabIndex: 0,
        role: 'note',
        'aria-label': summary
      }, [
        succeeded && successIcon(),
        failed && failedIcon(),
        running && runningIcon(),
        submitted && submittedIcon()
      ]),
      _.keys(collapsedStatuses(workflowStatuses)).length === 1 && span({
        style: { marginLeft: '0.5em' }
      }, [status])
    ])
  ])
}


const noJobsMessage = div({ style: { fontSize: 20, margin: '1rem' } }, [
  div([
    'You have not run any jobs yet. To get started, go to the ', span({ style: { fontWeight: 600 } }, ['Workflows']),
    ' tab and select a workflow to run.'
  ]),
  div({ style: { marginTop: '1rem', fontSize: 16 } }, [
    h(Link, {
      ...Utils.newTabLinkProps,
      href: `https://support.terra.bio/hc/en-us/articles/360027920592`
    }, [`What is a job?`])
  ])
])


const JobHistory = _.flow(
  Utils.forwardRefWithName('JobHistory'),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Job History', activeTab: 'job history'
  })
)(({ namespace, name, workspace, workspace: { workspace: { bucketName } } }, ref) => {
  // State
  const [submissions, setSubmissions] = useState(undefined)
  const [loading, setLoading] = useState(false)
  const [abortingId, setAbortingId] = useState(undefined)
  const [textFilter, setTextFilter] = useState('')
  const [sort, setSort] = useState({ field: 'submissionDate', direction: 'desc' })

  const scheduledRefresh = useRef()
  const signal = Utils.useCancellation()


  // Helpers
  const refresh = Utils.withBusyState(setLoading, async () => {
    try {
      const submissions = _.flow(
        _.orderBy('submissionDate', 'desc'),
        _.map(sub => {
          const {
            methodConfigurationName, methodConfigurationNamespace, status, submissionDate,
            submissionEntity: { entityType, entityName } = {}, submissionId, submitter
          } = sub

          const subAsText = _.join(' ', [
            methodConfigurationName, methodConfigurationNamespace, status, submissionDate, entityType, entityName, submissionId, submitter
          ]).toLowerCase()

          return _.set('asText', subAsText, sub)
        })
      )(await Ajax(signal).Workspaces.workspace(namespace, name).listSubmissions())
      setSubmissions(submissions)

      if (_.some(({ status }) => !isTerminal(status), submissions)) {
        scheduledRefresh.current = setTimeout(refresh, 1000 * 60)
      }
    } catch (error) {
      reportError('Error loading submissions list', error)
      setSubmissions([])
    }
  })

  const makeHeaderRenderer = name => () => h(HeaderRenderer, { sort, name, onSort: setSort })


  // Lifecycle
  Utils.useOnMount(() => {
    refresh()

    return () => {
      if (scheduledRefresh.current) {
        clearTimeout(scheduledRefresh.current)
      }
    }
  })

  useImperativeHandle(ref, () => ({ refresh }))


  // Render
  const filteredSubmissions = _.filter(({ asText }) => _.every(term => asText.includes(term.toLowerCase()), textFilter.split(/\s+/)), submissions)

  const sortedSubmissions = _.orderBy(
    Utils.cond(
      [sort.field === 'entityName', ['submissionEntity.entityName']],
      [sort.field === 'numberOfWorkflows', [s => _.sum(_.values(s.workflowStatuses))]],
      [sort.field === 'status', [s => {
        const { succeeded, failed, running, submitted } = collapsedStatuses(s.workflowStatuses)
        return [submitted, running, failed, succeeded]
      }]],
      sort.field
    ),
    [sort.direction],
    filteredSubmissions)

  const hasJobs = !_.isEmpty(submissions)
  const { running, submitted } = !!abortingId ? collapsedStatuses(_.find({ submissionId: abortingId }, filteredSubmissions).workflowStatuses) : {}

  return h(Fragment, [
    div({ style: { display: 'flex', alignItems: 'center', margin: '1rem 1rem 0' } }, [
      div({ style: { flexGrow: 1 } }),
      h(DelayedSearchInput, {
        'aria-label': 'Search',
        style: { width: 300, marginLeft: '1rem' },
        placeholder: 'Search',
        onChange: setTextFilter,
        value: textFilter
      })
    ]),
    div({ style: styles.submissionsTable }, [
      hasJobs && h(AutoSizer, [
        ({ width, height }) => h(FlexTable, {
          'aria-label': 'job history',
          width, height, rowCount: sortedSubmissions.length,
          hoverHighlight: true,
          noContentMessage: 'No matching jobs',
          sort,
          columns: [
            {
              size: { basis: 500, grow: 0 },
              // headerRenderer: () => h(HeaderCell, ['Submission (click for details)']),
              headerRenderer: makeHeaderRenderer('methodConfigurationName'),
              cellRenderer: ({ rowIndex }) => {
                const {
                  methodConfigurationNamespace, methodConfigurationName, submitter, submissionId, workflowStatuses
                } = sortedSubmissions[rowIndex]
                const { failed, running, submitted } = collapsedStatuses(workflowStatuses)

                return h(Clickable, {
                  hover: {
                    backgroundColor: Utils.cond(
                      [!!failed, () => colors.danger(0.3)],
                      [!!running || !!submitted, () => colors.accent(0.3)],
                      () => colors.success(0.3))
                  },
                  style: {
                    flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    margin: '0 -1rem', padding: '0 1rem', minWidth: 0,
                    fontWeight: 600,
                    backgroundColor: Utils.cond(
                      [!!failed, () => colors.danger(0.2)],
                      [!!running || !!submitted, () => colors.accent(0.2)],
                      () => colors.success(0.2))
                  },
                  tooltip: Utils.cond(
                    [!!failed, () => 'This job failed'],
                    [!!running || !!submitted, () => 'This job is running...'],
                    () => 'This job succeeded'
                  ),
                  href: Nav.getLink('workspace-submission-details', { namespace, name, submissionId })
                }, [
                  div({ style: Style.noWrapEllipsis }, [
                    methodConfigurationNamespace !== namespace && span({ style: styles.deemphasized }, [
                      `${methodConfigurationNamespace}/`
                    ]),
                    methodConfigurationName
                  ]),
                  div({ style: Style.noWrapEllipsis }, [
                    span({ style: styles.deemphasized }, 'Submitted by '),
                    submitter
                  ])
                ])
              }
            },
            {
              size: { basis: 250, grow: 0 },
              // headerRenderer: () => h(HeaderCell, ['Data entity']),
              headerRenderer: makeHeaderRenderer('entityName'),
              cellRenderer: ({ rowIndex }) => {
                const { submissionEntity: { entityName, entityType } = {} } = sortedSubmissions[rowIndex]
                return h(TooltipCell, [entityName && `${entityName} (${entityType})`])
              }
            },
            {
              size: { basis: 170, grow: 0 },
              // headerRenderer: () => h(HeaderCell, ['No. of Workflows']),
              headerRenderer: makeHeaderRenderer('numberOfWorkflows'),
              cellRenderer: ({ rowIndex }) => {
                const { workflowStatuses } = sortedSubmissions[rowIndex]
                return h(TextCell, Utils.formatNumber(_.sum(_.values(workflowStatuses))))
              }
            },
            {
              size: { basis: 150, grow: 0 },
              // headerRenderer: () => h(HeaderCell, ['Status']),
              headerRenderer: makeHeaderRenderer('status'),
              cellRenderer: ({ rowIndex }) => {
                const { workflowStatuses, status } = sortedSubmissions[rowIndex]
                return statusCell(workflowStatuses, status)
              }
            },
            {
              size: { min: 220, max: 220 },
              // headerRenderer: () => h(HeaderCell, ['Actions']),
              headerRenderer: makeHeaderRenderer('actions'),
              cellRenderer: ({ rowIndex }) => {
                const {
                  methodConfigurationNamespace, methodConfigurationName, methodConfigurationDeleted, submissionId, workflowStatuses,
                  status, submissionEntity
                } = sortedSubmissions[rowIndex]
                return h(Fragment, [
                  (!isTerminal(status) && status !== 'Aborting') && h(ButtonPrimary, {
                    onClick: () => setAbortingId(submissionId)
                  }, ['Abort workflows']),
                  isTerminal(status) && (workflowStatuses['Failed'] || workflowStatuses['Aborted']) &&
                  submissionEntity && !methodConfigurationDeleted && h(ButtonPrimary, {
                    onClick: () => rerunFailures({
                      workspace,
                      submissionId,
                      configNamespace: methodConfigurationNamespace,
                      configName: methodConfigurationName,
                      onDone: refresh
                    })
                  }, ['Relaunch failures'])
                ])
              }
            },
            {
              size: { basis: 150, grow: 0 },
              // headerRenderer: () => h(HeaderCell, ['Submitted']),
              headerRenderer: makeHeaderRenderer('submissionDate'),
              cellRenderer: ({ rowIndex }) => {
                const { submissionDate } = sortedSubmissions[rowIndex]
                return h(TooltipCell, { tooltip: Utils.makeCompleteDate(submissionDate) }, [Utils.makeCompleteDate(submissionDate)])
              }
            },
            {
              size: { basis: 150, grow: 1 },
              // headerRenderer: () => h(HeaderCell, ['Submission ID']),
              headerRenderer: makeHeaderRenderer('submissionId'),
              cellRenderer: ({ rowIndex }) => {
                const { submissionId } = sortedSubmissions[rowIndex]
                return h(TooltipCell, { tooltip: submissionId }, [
                  h(Link, {
                    ...Utils.newTabLinkProps,
                    href: bucketBrowserUrl(`${bucketName}/${submissionId}`)
                  }, [submissionId])
                ])
              }
            }
          ]
        })
      ]),
      !loading && !hasJobs && noJobsMessage,
      !!abortingId && h(Modal, {
        onDismiss: () => setAbortingId(undefined),
        title: 'Abort All Workflows',
        showX: true,
        okButton: async () => {
          try {
            setAbortingId(undefined)
            setLoading(true)
            await Ajax().Workspaces.workspace(namespace, name).submission(abortingId).abort()
            refresh()
          } catch (e) {
            setLoading(false)
            reportError('Error aborting submission', e)
          }
        }
      }, [
        `Are you sure you want to abort ${
          Utils.formatNumber(_.add(running, submitted))
        } running workflow(s)?`
      ]),
      loading && spinnerOverlay
    ])
  ])
})


export const navPaths = [
  {
    name: 'workspace-job-history',
    path: '/workspaces/:namespace/:name/job_history',
    component: JobHistory,
    title: ({ name }) => `${name} - Job History`
  }
]
