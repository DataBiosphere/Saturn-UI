import { isAfter, parseJSON } from 'date-fns/fp'
import _ from 'lodash/fp'
import { Fragment, useMemo, useState } from 'react'
import { div, h, span } from 'react-hyperscript-helpers'
import { AutoSizer } from 'react-virtualized'
import { HeaderRenderer, Link, makeMenuIcon, MenuButton, Select, topSpinnerOverlay, transparentSpinnerOverlay } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { icon } from 'src/components/icons'
import { DelayedSearchInput } from 'src/components/input'
import NewWorkspaceModal from 'src/components/NewWorkspaceModal'
import PopupTrigger from 'src/components/PopupTrigger'
import { SimpleTabBar } from 'src/components/tabBars'
import { FlexTable } from 'src/components/table'
import TooltipTrigger from 'src/components/TooltipTrigger'
import TopBar from 'src/components/TopBar'
import { NoWorkspacesMessage, useWorkspaces, WorkspaceTagSelect } from 'src/components/workspace-utils'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events from 'src/libs/events'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import DeleteWorkspaceModal from 'src/pages/workspaces/workspace/DeleteWorkspaceModal'
import { RequestAccessModal } from 'src/pages/workspaces/workspace/RequestAccessModal'
import ShareWorkspaceModal from 'src/pages/workspaces/workspace/ShareWorkspaceModal'


const styles = {
  tableCellContainer: {
    height: '100%', padding: '0.5rem 0', paddingRight: '2rem',
    borderTop: `1px solid ${colors.light()}`
  },
  tableCellContent: {
    height: '50%', display: 'flex', alignItems: 'center'
  },
  filter: { marginRight: '1rem', flex: '1 0 300px', minWidth: 0 }
}

const workspaceSubmissionStatus = ({ workspaceSubmissionStats: { runningSubmissionsCount, lastSuccessDate, lastFailureDate } }) => {
  return Utils.cond(
    [runningSubmissionsCount, () => 'running'],
    [lastSuccessDate && (!lastFailureDate || isAfter(parseJSON(lastFailureDate), parseJSON(lastSuccessDate))), () => 'success'],
    [lastFailureDate, () => 'failure']
  )
}

const WorkspaceMenuContent = ({ namespace, name, onClone, onShare, onDelete }) => {
  const [workspace, setWorkspace] = useState(undefined)
  const signal = Utils.useCancellation()
  const loadWorkspace = withErrorReporting('Error loading workspace', async () => {
    setWorkspace(await Ajax(signal).Workspaces.workspace(namespace, name).details(['accessLevel', 'canShare']))
  })
  Utils.useOnMount(() => {
    loadWorkspace()
  })

  const canRead = workspace && Utils.canRead(workspace.accessLevel)
  const canShare = workspace?.canShare
  const isOwner = workspace && Utils.isOwner(workspace.accessLevel)
  return h(Fragment, [
    h(MenuButton, {
      disabled: !canRead,
      tooltip: workspace && !canRead && 'You do not have access to the workspace Authorization Domain',
      tooltipSide: 'left',
      onClick: onClone
    }, [makeMenuIcon('copy'), 'Clone']),
    h(MenuButton, {
      disabled: !canShare,
      tooltip: workspace && !canShare && 'You have not been granted permission to share this workspace',
      tooltipSide: 'left',
      onClick: onShare
    }, [makeMenuIcon('share'), 'Share']),
    h(MenuButton, {
      disabled: !isOwner,
      tooltip: workspace && !isOwner && 'You must be an owner of this workspace or the underlying billing project',
      tooltipSide: 'left',
      onClick: onDelete
    }, [makeMenuIcon('trash'), 'Delete'])
  ])
}

export const WorkspaceList = () => {
  const { workspaces, refresh: refreshWorkspaces, loading: loadingWorkspaces } = useWorkspaces()
  const [featuredList, setFeaturedList] = useState()

  const transformStateArray = Utils.transformState(v => v || [], v => v)
  const transformStateEmptyDefault = (d, s) => Utils.transformState(v => v || d, v => v === d ? undefined : v, s)
  const [filter, setFilter] = transformStateEmptyDefault('', Nav.useQueryState('filter'))
  const [accessLevelsFilter, setAccessLevelsFilter] = transformStateArray(Nav.useQueryState('accessLevelsFilter'))
  const [projectsFilter, setProjectsFilter] = Nav.useQueryState('projectsFilter')
  const [submissionsFilter, setSubmissionsFilter] = transformStateArray(Nav.useQueryState('submissionsFilter'))
  const [tab, setTab] = transformStateEmptyDefault('myWorkspaces', Nav.useQueryState('tab'))
  const [tagsFilter, setTagsFilter] = transformStateArray(Nav.useQueryState('tagsFilter'))

  const [creatingNewWorkspace, setCreatingNewWorkspace] = useState(false)
  const [cloningWorkspaceId, setCloningWorkspaceId] = useState()
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState()
  const [sharingWorkspaceId, setSharingWorkspaceId] = useState()
  const [requestingAccessWorkspaceId, setRequestingAccessWorkspaceId] = useState()

  const [sort, setSort] = useState({ field: 'name', direction: 'asc' })

  Utils.useOnMount(() => {
    const loadFeatured = async () => {
      setFeaturedList(await Ajax().Buckets.getFeaturedWorkspaces())
    }

    loadFeatured()
  })

  const getWorkspace = id => _.find({ workspace: { workspaceId: id } }, workspaces)

  const initialFiltered = useMemo(() => {
    const [newWsList, featuredWsList] = _.partition('isNew', featuredList)

    return {
      myWorkspaces: _.filter(ws => !ws.public || Utils.canWrite(ws.accessLevel), workspaces),
      public: _.filter('public', workspaces),
      newAndInteresting: _.flow(
        _.map(({ namespace, name }) => _.find({ workspace: { namespace, name } }, workspaces)),
        _.compact
      )(newWsList),
      featured: _.flow(
        _.map(({ namespace, name }) => _.find({ workspace: { namespace, name } }, workspaces)),
        _.compact
      )(featuredWsList)
    }
  }, [workspaces, featuredList])

  const filteredWorkspaces = useMemo(() => _.mapValues(
    _.filter(ws => {
      const { workspace: { namespace, name, attributes } } = ws
      return Utils.textMatch(filter, `${namespace}/${name}`) &&
        (_.isEmpty(accessLevelsFilter) || accessLevelsFilter.includes(ws.accessLevel)) &&
        (_.isEmpty(projectsFilter) || projectsFilter === namespace) &&
        (_.isEmpty(submissionsFilter) || submissionsFilter.includes(workspaceSubmissionStatus(ws))) &&
        _.every(a => _.includes(a, _.get(['tag:tags', 'items'], attributes)), tagsFilter)
    }),
    initialFiltered), [accessLevelsFilter, filter, initialFiltered, projectsFilter, submissionsFilter, tagsFilter])

  const sortedWorkspaces = _.orderBy(
    [sort.field === 'accessLevel' ? ws => -Utils.workspaceAccessLevels.indexOf(ws.accessLevel) : `workspace.${sort.field}`],
    [sort.direction],
    filteredWorkspaces[tab]
  )

  const tabs = _.map(key => ({
    key,
    title: span([
      _.upperCase(key), ` (${loadingWorkspaces ? '...' : filteredWorkspaces[key].length})`
    ]),
    tableName: _.lowerCase(key)
  }), ['myWorkspaces', 'newAndInteresting', 'featured', 'public'])

  const currentTab = _.find({ key: tab }, tabs)

  const makeHeaderRenderer = name => () => h(HeaderRenderer, { sort, name, onSort: setSort })

  const renderedWorkspaces = div({ style: { flex: 1, backgroundColor: 'white', padding: '0 1rem' } }, [h(AutoSizer, [
    ({ width, height }) => h(FlexTable, {
      width, height,
      rowCount: sortedWorkspaces.length,
      tableName: currentTab?.tableName || 'workspaces',
      noContentRenderer: () => Utils.cond(
        [loadingWorkspaces, () => null],
        [_.isEmpty(initialFiltered.myWorkspaces) && tab === 'myWorkspaces', () => NoWorkspacesMessage({
          onClick: () => setCreatingNewWorkspace(true)
        })],
        () => div({ style: { fontStyle: 'italic' } }, ['No matching workspaces'])
      ),
      variant: 'light',
      rowHeight: 70,
      sort,
      columns: [
        {
          field: 'name',
          headerRenderer: makeHeaderRenderer('name'),
          cellRenderer: ({ rowIndex }) => {
            const { accessLevel, workspace: { workspaceId, namespace, name, attributes: { description } } } = sortedWorkspaces[rowIndex]
            const canView = Utils.canRead(accessLevel)
            const canAccessWorkspace = () => !canView ? setRequestingAccessWorkspaceId(workspaceId) : undefined

            return div({ style: styles.tableCellContainer }, [
              div({ style: styles.tableCellContent }, [
                h(Link, {
                  style: { color: canView ? undefined : colors.dark(0.7), fontWeight: 600, fontSize: 16, ...Style.noWrapEllipsis },
                  href: canView ? Nav.getLink('workspace-dashboard', { namespace, name }) : undefined,
                  onClick: () => {
                    canAccessWorkspace()
                    !!canView && Ajax().Metrics.captureEvent(Events.workspaceOpenFromList, { workspaceName: name, workspaceNamespace: namespace })
                  },
                  tooltip: !canView &&
                    'You cannot access this workspace because it is protected by an Authorization Domain. Click to learn about gaining access.',
                  tooltipSide: 'right'
                }, [name])
              ]),
              div({ style: styles.tableCellContent }, [
                span({ style: { ...Style.noWrapEllipsis, color: !!description ? undefined : colors.dark(0.75) } }, [
                  description?.split('\n')[0] || 'No description added'
                ])
              ])
            ])
          },
          size: { basis: 400, grow: 2, shrink: 0 }
        }, {
          field: 'lastModified',
          headerRenderer: makeHeaderRenderer('lastModified'),
          cellRenderer: ({ rowIndex }) => {
            const { workspace: { lastModified } } = sortedWorkspaces[rowIndex]

            return div({ style: styles.tableCellContainer }, [
              div({ style: styles.tableCellContent }, [
                h(TooltipTrigger, { content: Utils.makeCompleteDate(lastModified) }, [div([Utils.makeStandardDate(lastModified)])])
              ])
            ])
          },
          size: { basis: 100, grow: 1, shrink: 0 }
        }, {
          field: 'createdBy',
          headerRenderer: makeHeaderRenderer('createdBy'),
          cellRenderer: ({ rowIndex }) => {
            const { workspace: { createdBy } } = sortedWorkspaces[rowIndex]

            return div({ style: styles.tableCellContainer }, [
              div({ style: styles.tableCellContent }, [span({ style: Style.noWrapEllipsis }, [createdBy])])
            ])
          },
          size: { basis: 200, grow: 1, shrink: 0 }
        }, {
          field: 'accessLevel',
          headerRenderer: makeHeaderRenderer('accessLevel'),
          cellRenderer: ({ rowIndex }) => {
            const { accessLevel } = sortedWorkspaces[rowIndex]

            return div({ style: styles.tableCellContainer }, [
              div({ style: styles.tableCellContent }, [Utils.normalizeLabel(accessLevel)])
            ])
          },
          size: { basis: 120, grow: 1, shrink: 0 }
        }, {
          headerRenderer: () => null,
          cellRenderer: ({ rowIndex }) => {
            const { accessLevel, workspace: { workspaceId, namespace, name }, ...workspace } = sortedWorkspaces[rowIndex]
            const onClone = () => setCloningWorkspaceId(workspaceId)
            const onDelete = () => setDeletingWorkspaceId(workspaceId)
            const onShare = () => setSharingWorkspaceId(workspaceId)
            const canView = Utils.canRead(accessLevel)
            const lastRunStatus = workspaceSubmissionStatus(workspace)


            return div({ style: { ...styles.tableCellContainer, paddingRight: 0 } }, [
              div({ style: styles.tableCellContent }, [
                h(PopupTrigger, {
                  side: 'left',
                  closeOnClick: true,
                  content: h(WorkspaceMenuContent, { namespace, name, onShare, onClone, onDelete })
                }, [
                  h(Link, { 'aria-label': `Menu for Workspace: ${name}`, disabled: !canView }, [icon('cardMenuIcon', { size: 20 })])
                ])
              ]),
              div({ style: styles.tableCellContent }, [
                !!lastRunStatus && h(TooltipTrigger, {
                  content: span(['Last submitted workflow status: ', span({ style: { fontWeight: 600 } }, [_.startCase(lastRunStatus)])]),
                  side: 'left'
                }, [
                  Utils.switchCase(lastRunStatus,
                    ['success', () => icon('success-standard', { size: 20, style: { color: colors.success() } })],
                    ['failure', () => icon('error-standard', { size: 20, style: { color: colors.danger(0.85) } })],
                    ['running', () => icon('sync', { size: 20, style: { color: colors.success() } })]
                  )
                ])
              ])
            ])
          },
          size: { basis: 30, grow: 0, shrink: 0 }
        }
      ]
    })
  ])])


  return h(FooterWrapper, [
    h(TopBar, { title: 'Workspaces' }, [
      h(DelayedSearchInput, {
        style: { marginLeft: '2rem', width: 500 },
        placeholder: 'SEARCH WORKSPACES',
        'aria-label': 'Search workspaces',
        onChange: setFilter,
        value: filter
      })
    ]),
    div({ role: 'main', style: { padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' } }, [
      div({ style: { display: 'flex', alignItems: 'center', marginBottom: '1rem' } }, [
        div({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase' } }, ['Workspaces']),
        h(Link, {
          onClick: () => setCreatingNewWorkspace(true),
          style: { marginLeft: '0.5rem' },
          tooltip: 'Create a new workspace'
        },
        [icon('lighter-plus-circle', { size: 24 })])
      ]),
      div({ style: { display: 'flex', marginBottom: '1rem' } }, [
        div({ style: styles.filter }, [
          h(WorkspaceTagSelect, {
            isClearable: true,
            isMulti: true,
            formatCreateLabel: _.identity,
            value: _.map(tag => ({ label: tag, value: tag }), tagsFilter),
            placeholder: 'Tags',
            'aria-label': 'Filter by tags',
            onChange: data => setTagsFilter(_.map('value', data))
          })
        ]),
        div({ style: { ...styles.filter, flexBasis: '250px' } }, [
          h(Select, {
            isClearable: true,
            isMulti: true,
            isSearchable: false,
            placeholder: 'Access levels',
            'aria-label': 'Filter by access levels',
            value: accessLevelsFilter,
            onChange: data => setAccessLevelsFilter(_.map('value', data)),
            options: Utils.workspaceAccessLevels,
            getOptionLabel: ({ value }) => Utils.normalizeLabel(value)
          })
        ]),
        div({ style: styles.filter }, [
          h(Select, {
            isClearable: true,
            isMulti: false,
            placeholder: 'Billing project',
            'aria-label': 'Filter by billing project',
            value: projectsFilter,
            hideSelectedOptions: true,
            onChange: data => setProjectsFilter(!!data ? data.value : undefined),
            options: _.flow(
              _.map('workspace.namespace'),
              _.uniq,
              _.sortBy(_.identity)
            )(workspaces)
          })
        ]),
        div({ style: { ...styles.filter, flexBasis: '220px', marginRight: '' } }, [
          h(Select, {
            isClearable: true,
            isMulti: true,
            isSearchable: false,
            placeholder: 'Submission status',
            'aria-label': 'Filter by submission status',
            value: submissionsFilter,
            hideSelectedOptions: true,
            onChange: data => setSubmissionsFilter(_.map('value', data)),
            options: ['running', 'success', 'failure'],
            getOptionLabel: ({ value }) => Utils.normalizeLabel(value)
          })
        ])
      ]),
      h(SimpleTabBar, {
        label: 'choose a workspace collection',
        value: tab,
        onChange: newTab => {
          if (newTab === tab) {
            refreshWorkspaces()
          } else {
            setTab(newTab)
          }
        },
        tabs
      }, [renderedWorkspaces]),
      creatingNewWorkspace && h(NewWorkspaceModal, {
        onDismiss: () => setCreatingNewWorkspace(false),
        onSuccess: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name })
      }),
      cloningWorkspaceId && h(NewWorkspaceModal, {
        cloneWorkspace: getWorkspace(cloningWorkspaceId),
        onDismiss: () => setCloningWorkspaceId(undefined),
        onSuccess: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name })
      }),
      deletingWorkspaceId && h(DeleteWorkspaceModal, {
        workspace: getWorkspace(deletingWorkspaceId),
        onDismiss: () => setDeletingWorkspaceId(undefined),
        onSuccess: refreshWorkspaces
      }),
      sharingWorkspaceId && h(ShareWorkspaceModal, {
        workspace: getWorkspace(sharingWorkspaceId),
        onDismiss: () => setSharingWorkspaceId(undefined)
      }),
      requestingAccessWorkspaceId && h(RequestAccessModal, {
        workspace: getWorkspace(requestingAccessWorkspaceId),
        onDismiss: () => setRequestingAccessWorkspaceId(undefined)
      }),
      loadingWorkspaces && (!workspaces ? transparentSpinnerOverlay : topSpinnerOverlay)
    ])
  ])
}

export const navPaths = [
  {
    name: 'workspaces',
    path: '/workspaces',
    component: WorkspaceList,
    title: 'Workspaces'
  }
]
