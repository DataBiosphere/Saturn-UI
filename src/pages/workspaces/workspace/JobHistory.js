import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h, span, table, tbody, td, tr } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { Clickable, MenuButton, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import PopupTrigger from 'src/components/PopupTrigger'
import { FlexTable, HeaderCell, TextCell } from 'src/components/table'
import { Workspaces } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import * as Config from 'src/libs/config'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const styles = {
  submissionsTable: {
    padding: '1rem', flex: 1, marginBottom: '-2rem'
  },
  deemphasized: {
    color: colors.gray[2]
  },
  statusDetailCell: {
    align: 'center',
    style: { padding: '0.5rem' }
  }
}


const collapseStatus = status => {
  switch (status) {
    case 'Succeeded':
      return 'succeeded'
    case 'Aborting':
    case 'Aborted':
    case 'Failed':
      return 'failed'
    default:
      return 'running'
  }
}

const successIcon = style => icon('check', { size: 24, style: { color: colors.green[0], ...style } })
const failedIcon = style => icon('warning-standard', { className: 'is-solid', size: 24, style: { color: colors.red[0], ...style } })
const runningIcon = style => icon('sync', { size: 24, style: { color: colors.green[0], ...style } })


export const flagNewSubmission = submissionId => {
  sessionStorage.setItem('new-submission', submissionId)
}

const collapsedStatuses = _.flow(
  _.toPairs,
  _.map(([status, count]) => ({ [collapseStatus(status)]: count })),
  _.reduce(_.mergeWith(_.add), {})
)

const statusCell = workflowStatuses => {
  const { succeeded, failed, running } = collapsedStatuses(workflowStatuses)

  return h(Fragment, [
    succeeded && successIcon({ marginRight: '0.5rem' }),
    failed && failedIcon({ marginRight: '0.5rem' }),
    running && runningIcon({ marginRight: '0.5rem' }),
    h(PopupTrigger, {
      position: 'bottom',
      content: table({ style: { margin: '0.5rem' } }, [
        tbody({}, [
          tr({}, [
            td(styles.statusDetailCell, [successIcon()]),
            td(styles.statusDetailCell, [failedIcon()]),
            td(styles.statusDetailCell, [runningIcon()])
          ]),
          tr({}, [
            td(styles.statusDetailCell, [succeeded || 0]),
            td(styles.statusDetailCell, [failed || 0]),
            td(styles.statusDetailCell, [running || 0])
          ])
        ])
      ])
    }, [
      h(Clickable, {
        className: 'hover-only',
        style: { color: colors.blue[1] }
      }, [icon('caretDown', { size: 18 })])
    ])
  ])
}

const animationLengthMillis = 1000


const JobHistory = wrapWorkspace({
  breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
  title: 'Job History', activeTab: 'job history'
},
class JobHistoryContent extends Component {
  constructor(props) {
    super(props)

    const newSubmissionId = sessionStorage.getItem('new-submission')
    if (newSubmissionId) {
      sessionStorage.removeItem('new-submission')
      this.state = { newSubmissionId, highlightNewSubmission: true }
    }
  }

  async refresh() {
    const { namespace, name } = this.props

    try {
      this.setState({ loading: true })
      const submissions = _.orderBy('submissionDate', 'desc', await Workspaces.workspace(namespace, name).listSubmissions())
      this.setState({ submissions })

      if (_.some(sub => sub.status !== 'Done', submissions)) {
        this.scheduledRefresh = setTimeout(() => this.refresh(), 1000 * 60)
      }
    } catch (error) {
      reportError('Error loading submissions list', error)
      this.setState({ submissions: [] })
    } finally {
      this.setState({ loading: false })
    }

    if (this.state.newSubmissionId) {
      await Utils.waitOneTick()
      this.setState({ highlightNewSubmission: false })
      await Utils.delay(animationLengthMillis)
      this.setState({ newSubmissionId: undefined })
    }
  }

  render() {
    const { namespace, name } = this.props
    const { submissions, loading, aborting, newSubmissionId, highlightNewSubmission, firecloudRoot } = this.state

    return div({ style: styles.submissionsTable }, [
      submissions && !!submissions.length && h(AutoSizer, [
        ({ width, height }) => h(FlexTable, {
          width, height, rowCount: submissions.length,
          hoverHighlight: true,
          rowStyle: rowIndex => {
            const { submissionId } = submissions[rowIndex]
            if (newSubmissionId === submissionId) {
              return {
                transition: `background-color ${animationLengthMillis}ms cubic-bezier(0.33, -2, 0.74, 0.05)`,
                backgroundColor: highlightNewSubmission ? colors.blue[5] : 'white'
              }
            }
          },
          columns: [
            {
              headerRenderer: () => h(HeaderCell, ['Job']),
              cellRenderer: ({ rowIndex }) => {
                const { methodConfigurationNamespace, methodConfigurationName, submitter, submissionId, workflowStatuses } = submissions[rowIndex]
                return h(Fragment, [
                  div([
                    div([
                      methodConfigurationNamespace !== namespace && span({ style: styles.deemphasized }, [
                        `${methodConfigurationNamespace}/`
                      ]),
                      methodConfigurationName
                    ]),
                    div([
                      span({ style: styles.deemphasized }, 'Submitted by '),
                      submitter
                    ])
                  ]),
                  h(PopupTrigger, {
                    position: 'bottom',
                    closeOnClick: true,
                    content: h(Fragment, [
                      h(MenuButton, {
                        as: 'a',
                        target: '_blank',
                        href: `${firecloudRoot}/#workspaces/${namespace}/${name}/monitor/${submissionId}`
                      }, [
                        icon('circle-arrow right'),
                        div({ style: { marginLeft: '0.5rem' } }, ['View job details'])
                      ]),
                      collapsedStatuses(workflowStatuses).running && h(MenuButton, {
                        onClick: () => this.setState({ aborting: submissionId })
                      }, [
                        icon('warning-standard', { style: { color: colors.orange[0] } }),
                        div({ style: { marginLeft: '0.5rem' } }, ['Abort all workflows'])
                      ])
                    ])
                  }, [
                    h(Clickable, {
                      className: 'hover-only',
                      style: { marginLeft: 'auto', color: colors.blue[1] }
                    }, [icon('caretDown', { size: 18 })])
                  ])
                ])
              }
            },
            {
              size: { basis: 175, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['No. of Workflows']),
              cellRenderer: ({ rowIndex }) => {
                const { workflowStatuses } = submissions[rowIndex]
                return h(TextCell, Utils.formatNumber(_.sum(_.values(workflowStatuses))))
              }
            },
            {
              size: { basis: 150, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Status']),
              cellRenderer: ({ rowIndex }) => {
                const { workflowStatuses, status } = submissions[rowIndex]
                return h(Fragment, [statusCell(workflowStatuses), status === 'Aborting' && 'Aborting'])
              }
            },
            {
              size: { basis: 250, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Submitted']),
              cellRenderer: ({ rowIndex }) => {
                const { submissionDate } = submissions[rowIndex]
                return h(TextCell, Utils.makePrettyDate(submissionDate))
              }
            }
          ]
        })
      ]),
      submissions && !submissions.length && div(['No jobs run']),
      aborting && h(Modal, {
        onDismiss: () => this.setState({ aborting: undefined }),
        title: 'Abort All Workflows',
        showX: true,
        okButton: () => {
          Workspaces.workspace(namespace, name).abortSubmission(aborting)
            .then(() => this.refresh())
            .catch(e => this.setState({ loading: false }, () => reportError('Error aborting submission', e)))
          this.setState({ aborting: undefined, loading: true })
        }
      }, [
        `Are you sure you want to abort ${
          Utils.formatNumber(collapsedStatuses(_.find({ submissionId: aborting }, submissions).workflowStatuses).running)
        } running workflow(s)?`
      ]),
      loading && spinnerOverlay
    ])
  }

  async componentDidMount() {
    this.refresh()
    this.setState({ firecloudRoot: await Config.getFirecloudUrlRoot() })
  }

  componentWillUnmount() {
    if (this.scheduledRefresh) {
      clearTimeout(this.scheduledRefresh)
    }
  }
})


export const addNavPaths = () => {
  Nav.defPath('workspace-job-history', {
    path: '/workspaces/:namespace/:name/job_history',
    component: JobHistory,
    title: ({ name }) => `${name} - Job History`
  })
}
