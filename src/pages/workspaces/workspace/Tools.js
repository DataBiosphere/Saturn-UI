import _ from 'lodash/fp'
import { Fragment } from 'react'
import { a, div, h } from 'react-hyperscript-helpers'
import { pure } from 'recompose'
import * as breadcrumbs from 'src/components/breadcrumbs'
import togglesListView from 'src/components/CardsListToggle'
import {
  buttonOutline, buttonPrimary, Clickable, link, Markdown, MenuButton, menuIcon, methodLink, PageBox, spinnerOverlay
} from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import PopupTrigger from 'src/components/PopupTrigger'
import { ajaxCaller } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { getConfig } from 'src/libs/config'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import { dockstoreTile, fcMethodRepoTile, makeToolCard } from 'src/pages/library/Code'
import DeleteToolModal from 'src/pages/workspaces/workspace/tools/DeleteToolModal'
import ExportToolModal from 'src/pages/workspaces/workspace/tools/ExportToolModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const styles = {
  cardContainer: listView => ({
    display: 'flex', flexWrap: 'wrap',
    marginRight: listView ? undefined : '-1rem'
  }),
  // Card's position: relative and the outer/inner styles are a little hack to fake nested links
  card: {
    ...Style.elements.card.container, position: 'relative'
  },
  outerLink: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0
  },
  innerContent: {
    position: 'relative', pointerEvents: 'none'
  },
  innerLink: {
    pointerEvents: 'auto'
  },
  // (end link hacks)
  shortCard: {
    width: 300, height: 125, margin: '0 1rem 2rem 0'
  },
  shortTitle: {
    ...Style.elements.card.title,
    flex: 1,
    lineHeight: '20px', height: '40px',
    overflowWrap: 'break-word'
  },
  shortDescription: {
    flex: 'none',
    lineHeight: '18px', height: '90px',
    overflow: 'hidden'
  },
  longMethodVersion: {
    marginRight: '1rem', width: 90,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  },
  longCard: {
    width: '100%', minWidth: 0,
    marginBottom: '0.5rem'
  },
  longTitle: {
    ...Style.elements.card.title,
    whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1
  },
  longDescription: {
    flex: 1,
    paddingRight: '1rem',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  }
}

const ToolCard = pure(({ listView, name, namespace, config, onCopy, onDelete }) => {
  const { namespace: workflowNamespace, name: workflowName, methodRepoMethod: { sourceRepo, methodVersion } } = config
  const toolCardMenu = h(PopupTrigger, {
    closeOnClick: true,
    content: h(Fragment, [
      h(MenuButton, {
        onClick: () => onCopy()
      }, [menuIcon('copy'), 'Copy to Another Workspace']),
      h(MenuButton, {
        onClick: () => onDelete()
      }, [menuIcon('trash'), 'Delete'])
    ])
  }, [
    h(Clickable, {
      onClick: e => e.stopPropagation(),
      style: {
        cursor: 'pointer', color: colors.green[0], ...styles.innerLink
      },
      focus: 'hover',
      hover: { color: colors.green[2] }
    }, [
      icon('cardMenuIcon', {
        size: listView ? 18 : 24
      })
    ])
  ])
  const repoLink = link({
    href: methodLink(config),
    style: styles.innerLink,
    target: '_blank',
    onClick: e => e.stopPropagation()
  }, sourceRepo === 'agora' ? 'FireCloud' : sourceRepo)

  const workflowLink = a({
    href: Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName }),
    style: styles.outerLink
  })

  return listView ?
    div({ style: { ...styles.card, ...styles.longCard } }, [
      workflowLink,
      div({ style: { ...styles.innerContent, display: 'flex', alignItems: 'center' } }, [
        div({ style: { marginRight: '1rem' } }, [toolCardMenu]),
        div({ style: styles.longTitle }, [workflowName]),
        div({ style: styles.longMethodVersion }, [`V. ${methodVersion}`]),
        div({ style: { flex: 'none', width: 130 } }, ['Source: ', repoLink])
      ])
    ]) :
    div({ style: { ...styles.card, ...styles.shortCard } }, [
      workflowLink,
      div({ style: { ...styles.innerContent, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' } }, [
        div({ style: styles.shortTitle }, [workflowName]),
        div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } }, [
          div([div([`V. ${methodVersion}`]), 'Source: ', repoLink]), toolCardMenu
        ])
      ])
    ])
})

const FindToolModal = ajaxCaller(class FindToolModal extends Component {
  async componentDidMount() {
    const { ajax: { Methods } } = this.props

    const [featuredList, methods] = await Promise.all([
      fetch(`${getConfig().firecloudBucketRoot}/featured-methods.json`).then(res => res.json()),
      Methods.list({ namespace: 'gatk' })
    ])

    this.setState({ featuredList, methods })
  }

  render() {
    const { onDismiss } = this.props
    const { selectedTool, featuredList, methods, selectedToolDetails, exporting } = this.state

    const featuredMethods = _.compact(_.map(
      ({ namespace, name }) => _.maxBy('snapshotId', _.filter({ namespace, name }, methods)),
      featuredList
    ))

    const { synopsis, managers, documentation } = selectedToolDetails || {}

    const renderDetails = () => [
      div({ style: { display: 'flex' } }, [
        div({ style: { flexGrow: 1 } }, [
          div({ style: { fontSize: 18, fontWeight: 600, margin: '1rem 0 0.5rem' } }, ['Synopsis']),
          div([synopsis || (selectedToolDetails && 'None')]),
          div({ style: { fontSize: 18, fontWeight: 600, margin: '1rem 0 0.5rem' } }, ['Method Owner']),
          div([_.join(',', managers)])
        ]),
        div({ style: { margin: '0 1rem', display: 'flex', flexDirection: 'column' } }, [
          buttonPrimary({ style: { marginBottom: '0.5rem' }, onClick: () => this.setState({ exporting: true }) }, ['Add to Workspace']),
          buttonOutline({ onClick: () => this.setState({ selectedTool: undefined, selectedToolDetails: undefined }) }, ['Return to List'])
        ])
      ]),
      div({ style: { fontSize: 18, fontWeight: 600, margin: '1rem 0 0.5rem' } }, ['Documentation']),
      documentation && h(Markdown, { style: { maxHeight: 600, overflowY: 'auto' } }, [documentation]),
      !selectedToolDetails && centeredSpinner()
    ]

    const renderList = () => [
      div({ style: { display: 'flex', flexWrap: 'wrap', overflowY: 'auto', height: 400, paddingTop: 5, paddingLeft: 5 } }, [
        ...(featuredMethods ? _.map(method => makeToolCard(method, () => this.loadMethod(method)), featuredMethods) : [centeredSpinner()])
      ]),
      div({ style: { fontSize: 18, fontWeight: 600, marginTop: '1rem' } }, ['Find Additional Tools']),
      div({ style: { display: 'flex', padding: '0.5rem' } }, [
        div({ style: { flex: 1, marginRight: 10 } }, [dockstoreTile]),
        div({ style: { flex: 1, marginLeft: 10 } }, [fcMethodRepoTile])
      ])
    ]

    const renderExportForm = () => [

    ]

    return h(Modal, {
      onDismiss,
      showButtons: false,
      title: selectedTool ? `Tool: ${selectedTool.name}` : 'Suggested Tools',
      showX: true,
      width: 900
    }, Utils.cond(
      [selectedTool, () => renderDetails()],
      [exporting, () => renderExportForm()],
      () => renderList()
    ))
  }

  async loadMethod(selectedTool) {
    const { ajax: { Methods } } = this.props
    const { namespace, name, snapshotId } = selectedTool

    this.setState({ selectedTool })
    try {
      const selectedToolDetails = await Methods.method(namespace, name, snapshotId).get()
      this.setState({ selectedToolDetails })
    } catch (error) {
      reportError('Error loading tool', error)
      this.setState({ selectedTool: undefined })
    }
  }

  async exportMethod() {
    const { namespace, name, ajax: { Methods, Workspaces } } = this.props
    const { selectedTool } = this.state

    try {
      const wsEntities = await Workspaces.workspace(namespace, name).entityMetadata()
      /*
      {
        namespace, name: workflowName, rootEntityType: _.head(_.keys(entityMetadata)),
        inputs: {}, outputs: {}, prerequisites: {}, methodConfigVersion: 1, deleted: false,
        methodRepoMethod: {
          sourceRepo: 'dockstore',
          methodPath: path,
          methodVersion: version
        }
      }
      */

      await Methods.method(selectedTool.namespace, selectedTool.name, selectedTool.snapshotId)
        .toWorkspace({ namespace, name }, { namespace: selectedTool.namespace, name: selectedTool.name })

      Nav.goToPath('workflow', { namespace, name, workflowNamespace: selectedTool.namespace, workflowName: selectedTool.name })
    } catch (error) {
      reportError('Error importing tool', error)
    }
  }
})

export const Tools = _.flow(
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Tools', activeTab: 'tools'
  }),
  togglesListView('toolsTab'),
  ajaxCaller
)(class Tools extends Component {
  constructor(props) {
    super(props)
    this.state = StateHistory.get()
  }

  async refresh() {
    const { namespace, name, ajax: { Workspaces } } = this.props

    try {
      this.setState({ loading: true })
      const configs = await Workspaces.workspace(namespace, name).listMethodConfigs()
      this.setState({ configs })
    } catch (error) {
      reportError('Error loading configs', error)
    } finally {
      this.setState({ loading: false })
    }
  }

  getConfig({ namespace, name }) {
    const { configs } = this.state
    return _.find({ namespace, name }, configs)
  }

  render() {
    const { namespace, name, listView, viewToggleButtons, workspace: { workspace } } = this.props
    const { loading, configs, copyingTool, deletingTool, findingTool } = this.state

    const tools = _.map(config => {
      return h(ToolCard, {
        onCopy: () => this.setState({ copyingTool: { namespace: config.namespace, name: config.name } }),
        onDelete: () => this.setState({ deletingTool: { namespace: config.namespace, name: config.name } }),
        key: `${config.namespace}/${config.name}`, namespace, name, config, listView
      })
    }, configs)

    return h(PageBox, [
      div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' } }, [
        div({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase' } }, ['Tools']),
        viewToggleButtons,
        copyingTool && h(ExportToolModal, {
          thisWorkspace: workspace, methodConfig: this.getConfig(copyingTool),
          onDismiss: () => this.setState({ copyingTool: undefined })
        }),
        deletingTool && h(DeleteToolModal, {
          workspace, methodConfig: this.getConfig(deletingTool),
          onDismiss: () => this.setState({ deletingTool: undefined }),
          onSuccess: () => {
            this.refresh()
            this.setState({ deletingTool: undefined })
          }
        })
      ]),
      div({ style: styles.cardContainer(listView) }, [
        h(Clickable, {
          style: { ...styles.card, ...styles.shortCard, color: colors.green[0], fontSize: 18, lineHeight: '22px' },
          onClick: () => this.setState({ findingTool: true })
        }, [
          'Find a Tool',
          icon('plus-circle', { size: 32 })
        ]),
        listView ? div({ style: { flex: 1 } }, [tools]) : tools,
        findingTool && h(FindToolModal, {
          namespace, name,
          onDismiss: () => this.setState({ findingTool: false })
        }),
        configs && !configs.length && div(['No tools added']),
        loading && spinnerOverlay
      ])
    ])
  }

  async componentDidMount() {
    this.refresh()
  }

  componentDidUpdate() {
    StateHistory.update(_.pick(['configs'], this.state))
  }
})

export const addNavPaths = () => {
  Nav.defPath('workspace-tools', {
    path: '/workspaces/:namespace/:name/tools',
    component: Tools,
    title: ({ name }) => `${name} - Tools`
  })
}
