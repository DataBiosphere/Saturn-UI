import _ from 'lodash/fp'
import { Fragment } from 'react'
import { a, div, h, span } from 'react-hyperscript-helpers'
import { pure } from 'recompose'
import removeMd from 'remove-markdown'
import { Clickable, PageFadeBox, search, spinnerOverlay, viewToggleButtons, MenuButton } from 'src/components/common'
import { icon } from 'src/components/icons'
import NewWorkspaceModal from 'src/components/NewWorkspaceModal'
import PopupTrigger from 'src/components/PopupTrigger'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { TopBar } from 'src/components/TopBar'
import { ajaxCaller } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import DeleteWorkspaceModal from 'src/pages/workspaces/workspace/DeleteWorkspaceModal'
import ShareWorkspaceModal from 'src/pages/workspaces/workspace/ShareWorkspaceModal'


const styles = {
  cardContainer: listView => ({
    position: 'relative',
    display: 'flex', flexWrap: listView ? undefined : 'wrap', marginRight: listView ? undefined : '-1rem'
  }),
  shortCard: {
    ...Style.elements.card,
    width: 300, height: 225,
    margin: '0 1rem 2rem 0'
  },
  shortWorkspaceCard: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  },
  shortTitle: {
    flex: 'none',
    color: colors.blue[0], fontSize: 16,
    lineHeight: '20px', height: '40px',
    overflow: 'hidden', wordWrap: 'break-word'
  },
  shortDescription: {
    flex: 'none',
    whiteSpace: 'pre-wrap',
    lineHeight: '18px', height: '90px',
    overflow: 'hidden'
  },
  shortCreateCard: {
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    color: colors.blue[0], fontSize: 20, lineHeight: '28px'
  },
  longCard: {
    ...Style.elements.card,
    width: '100%', minWidth: 0, height: 80,
    margin: '0.5rem 1rem 0 0'
  },
  longWorkspaceCard: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: '0.5rem'
  },
  longTitle: {
    color: colors.blue[0], fontSize: 16,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
  },
  longDescription: {
    flex: 1,
    paddingRight: '1rem',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  },
  badge: {
    height: '1.5rem', width: '1.5rem', borderRadius: '1.5rem',
    lineHeight: '1.5rem', textAlign: 'center',
    backgroundColor: colors.purple[0], color: 'white'
  }
}

const WorkspaceCard = pure(({ listView, onClone, onDelete, onShare, workspace: { accessLevel, workspace: { namespace, name, createdBy, lastModified, attributes: { description } } } }) => {
  const lastChanged = `Last changed: ${Utils.makePrettyDate(lastModified)}`
  const badge = div({ title: createdBy, style: styles.badge }, [createdBy[0].toUpperCase()])
  const isOwner = Utils.isOwner(accessLevel)
  const iconHelp = (iconName, iconLabel) => {
    return h(Fragment, [icon(iconName, { size: 15, style: { marginRight: '.25rem' } }), iconLabel])
  }
  const workspaceMenu = h(PopupTrigger, {
    position: 'right',
    closeOnClick: true,
    content: h(Fragment, [
      h(MenuButton, {
        onClick: () => onClone()
      }, [iconHelp('copy', 'Clone')]),
      h(MenuButton, {
        disabled: !isOwner,
        tooltip: !isOwner && 'You must be an owner of this workspace or the underlying billing project',
        tooltipSide: 'left',
        onClick: () => onShare()
      }, [iconHelp('share', 'Share')]),
      h(MenuButton, {
        disabled: !isOwner,
        tooltip: !isOwner && 'You must be an owner of this workspace or the underlying billing project',
        tooltipSide: 'left',
        onClick: () => onDelete()
      }, [iconHelp('trash', 'Delete')])
    ])
  }, [
    h(Clickable, {
      onClick: e => e.preventDefault(),
      style: {
        cursor: 'pointer', color: colors.blue[0]
      },
      focus: 'hover',
      hover: { color: colors.blue[2] }
    }, [
      icon('cardMenuIcon', {
        size: listView ? 18 : 27
      })
    ])
  ])
  const descText = description ?
    removeMd(listView ? description.split('\n')[0] : description) :
    span({ style: { color: colors.gray[2] } }, ['No description added'])

  return listView ? a({
    href: Nav.getLink('workspace', { namespace, name }),
    style: { ...styles.longCard, ...styles.longWorkspaceCard }
  }, [
    div({ style: { display: 'flex', alignItems: 'center' } }, [
      workspaceMenu,
      div({ style: { ...styles.longTitle, marginLeft: '1rem' } }, [name]),
      h(TooltipTrigger, { content: Utils.makeCompleteDate(lastModified) }, [
        div({ style: { flex: 'none' } }, [lastChanged])
      ])
    ]),
    div({ style: { display: 'flex', alignItems: 'center' } }, [
      div({ style: styles.longDescription }, [descText]),
      div({ style: { flex: 'none' } }, [badge])
    ])
  ]) : a({
    href: Nav.getLink('workspace', { namespace, name }),
    style: { ...styles.shortCard, ...styles.shortWorkspaceCard }
  }, [
    div({ style: styles.shortTitle }, [name]),
    div({ style: styles.shortDescription }, [descText]),
    div({ style: { display: 'flex', marginLeft: 'auto' } }, [badge]),
    div({ style: { display: 'flex', alignItems: 'center' } }, [
      h(TooltipTrigger, { content: Utils.makeCompleteDate(lastModified) }, [
        div({ style: { flex: 1 } }, [lastChanged])
      ]),
      workspaceMenu
    ])
  ])
})

const NewWorkspaceCard = pure(({ onClick }) => {
  return h(Clickable, {
    style: { ...styles.shortCard, ...styles.shortCreateCard },
    onClick
  }, [
    div(['Create a']),
    div(['New Workspace']),
    icon('plus-circle', { style: { marginTop: '0.5rem' }, size: 32 })
  ])
})


export const WorkspaceList = ajaxCaller(class WorkspaceList extends Component {
  constructor(props) {
    super(props)
    this.state = {
      filter: '',
      listView: false,
      workspaces: null,
      creatingNewWorkspace: false,
      cloningWorkspaceId: undefined,
      deletingWorkspaceId: undefined,
      sharingWorkspaceId: undefined,
      ...StateHistory.get()
    }
  }

  async refresh() {
    const { ajax: { Workspaces } } = this.props
    try {
      this.setState({ isDataLoaded: false })
      const workspaces = await Workspaces.list()
      this.setState({
        isDataLoaded: true,
        workspaces: _.flow(
          _.filter(ws => !ws.public || Utils.canRead(ws.accessLevel)),
          _.sortBy('workspace.name')
        )(workspaces)
      })
    } catch (error) {
      reportError('Error loading workspace list', error)
    }
  }

  componentDidMount() {
    this.refresh()
  }

  getWorkspace(id) {
    const { workspaces } = this.state
    return _.find({ workspace: { workspaceId: id } }, workspaces)
  }

  render() {
    const {
      workspaces, isDataLoaded, filter, listView,
      creatingNewWorkspace, cloningWorkspaceId, deletingWorkspaceId, sharingWorkspaceId
    } = this.state

    const data = _.filter(({ workspace: { namespace, name } }) => {
      return Utils.textMatch(filter, `${namespace}/${name}`)
    }, workspaces)
    const renderedWorkspaces = _.map(workspace => {
      return h(WorkspaceCard, {
        listView,
        onClone: () => this.setState({ cloningWorkspaceId: workspace.workspace.workspaceId }),
        onDelete: () => this.setState({ deletingWorkspaceId: workspace.workspace.workspaceId }),
        onShare: () => this.setState({ sharingWorkspaceId: workspace.workspace.workspaceId }),
        workspace, key: workspace.workspace.workspaceId
      })
    }, data)
    return h(Fragment, [
      h(TopBar, { title: 'Workspaces' }, [
        search({
          wrapperProps: { style: { marginLeft: '2rem', flexGrow: 1, maxWidth: 500 } },
          inputProps: {
            placeholder: 'SEARCH WORKSPACES',
            onChange: e => this.setState({ filter: e.target.value }),
            value: filter
          }
        })
      ]),
      h(PageFadeBox, [
        div({
          style: {
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            marginBottom: '1rem'
          }
        }, [
          div({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase' } }, [
            'Workspaces'
          ]),
          viewToggleButtons(listView, listView => this.setState({ listView }))
        ]),
        div({ style: styles.cardContainer(listView) }, [
          h(NewWorkspaceCard, {
            onClick: () => this.setState({ creatingNewWorkspace: true })
          }),
          !isDataLoaded && spinnerOverlay,
          listView ?
            div({ style: { flex: 1, minWidth: 0, margin: '-0.5rem 0rem 0rem 0.75rem' } }, [
              renderedWorkspaces
            ]) : renderedWorkspaces
        ]),
        !isDataLoaded && spinnerOverlay,
        creatingNewWorkspace && h(NewWorkspaceModal, {
          onDismiss: () => this.setState({ creatingNewWorkspace: false })
        }),
        cloningWorkspaceId && h(NewWorkspaceModal, {
          cloneWorkspace: this.getWorkspace(cloningWorkspaceId),
          onDismiss: () => this.setState({ cloningWorkspaceId: undefined })
        }),
        deletingWorkspaceId && h(DeleteWorkspaceModal, {
          workspace: this.getWorkspace(deletingWorkspaceId),
          onDismiss: () => { this.setState({ deletingWorkspaceId: undefined }) },
          onSuccess: () => this.refresh()
        }),
        sharingWorkspaceId && h(ShareWorkspaceModal, {
          namespace: this.getWorkspace(sharingWorkspaceId).workspace.namespace,
          name: this.getWorkspace(sharingWorkspaceId).workspace.name,
          onDismiss: () => { this.setState({ sharingWorkspaceId: undefined }) }
        })
      ])
    ])
  }

  componentDidUpdate() {
    StateHistory.update(_.pick(
      ['workspaces', 'filter', 'listView'],
      this.state)
    )
  }
})

export const addNavPaths = () => {
  Nav.defPath('root', {
    path: '/',
    component: () => h(Nav.Redirector, { pathname: '/workspaces' })
  })
  Nav.defPath('workspaces', {
    path: '/workspaces',
    component: WorkspaceList,
    title: 'Workspaces'
  })
}
