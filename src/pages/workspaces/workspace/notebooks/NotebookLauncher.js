import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h, iframe } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { icon, spinner } from 'src/components/icons'
import { Jupyter } from 'src/libs/ajax'
import { reportError } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const styles = {
  pageContainer: {
    padding: '2rem'
  },
  step: {
    container: {
      display: 'flex',
      alignItems: 'center',
      lineHeight: '2rem',
      margin: '0.5rem 0'
    },
    col1: {
      flex: '0 0 30px'
    },
    col2: {
      flex: 1
    }
  }
}


const NotebookLauncher = wrapWorkspace({
  breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
  title: ({ notebookName }) => `Notebooks - ${notebookName}`,
  activeTab: 'notebooks'
},
class NotebookLauncherContent extends Component {
  constructor(props) {
    super(props)
    this.state = { localizeFailures: 0 }
  }

  async componentDidMount() {
    this.mounted = true

    try {
      const cluster = await this.startCluster()
      await this.localizeNotebook(cluster)

      const { name: workspaceName, notebookName } = this.props
      this.setState({ url: `${cluster.clusterUrl}/notebooks/${workspaceName}/${notebookName}` })
    } catch (error) {
      if (this.mounted) {
        reportError('Error launching notebook', error)
        this.setState({ failed: true })
      }
    }
  }

  componentWillUnmount() {
    this.mounted = false
  }

  async getCluster() {
    const { clusters } = this.props

    return _.flow(
      _.remove({ status: 'Deleting' }),
      _.sortBy('createdDate'),
      _.last
    )(clusters)
  }

  async startCluster() {
    const { refreshClusters } = this.props

    while (this.mounted) {
      await refreshClusters()

      const cluster = await this.getCluster()
      if (!cluster) {
        throw new Error('No clusters available')
      }

      const { status, googleProject, clusterName } = cluster
      this.setState({ clusterStatus: status })

      if (status === 'Running') {
        return cluster
      } else if (status === 'Stopped') {
        await Jupyter.cluster(googleProject, clusterName).start()
        refreshClusters()
        await Utils.delay(10000)
      } else {
        await Utils.delay(3000)
      }
    }
  }

  async localizeNotebook(cluster) {
    const { namespace, name: workspaceName, notebookName, workspace: { workspace: { bucketName } } } = this.props
    const { clusterName } = cluster

    await Jupyter.notebooks(namespace, clusterName).setCookie()

    while (this.mounted) {
      try {
        await Promise.all([
          Jupyter.notebooks(namespace, clusterName).localize({
            [`~/${workspaceName}/.delocalize.json`]: `data:application/json,{"destination":"gs://${bucketName}/notebooks","pattern":""}`
          }),
          Jupyter.notebooks(namespace, clusterName).localize({
            [`~/${workspaceName}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
          })
        ])
        return
      } catch (e) {
        const { localizeFailures } = this.state

        if (localizeFailures < 5) {
          this.setState({ localizeFailures: localizeFailures + 1 })
          await Utils.delay(5000)
        } else {
          throw new Error('Unable to copy notebook to cluster')
        }
      }
    }
  }

  render() {
    const { clusterStatus, localizeFailures, failed, url } = this.state

    if (url) {
      return iframe({
        src: url, height: 500,
        style: { border: 'none' }
      })
    }

    const currentStep = clusterStatus !== 'Running' ? 1 : 2

    const step = (index, text) => div({ style: styles.step.container }, [
      div({ style: styles.step.col1 }, [
        index < currentStep && icon('check', { size: 24, style: { color: Style.colors.success } }),
        index === currentStep && (failed ? icon('times', { size: 24, style: { color: Style.colors.error } }) : spinner())
      ]),
      div({ style: styles.step.col2 }, [text])
    ])

    return h(Fragment, [
      div({ style: styles.pageContainer }, [
        div({ style: Style.elements.sectionHeader }, 'Saturn is preparing your notebook'),
        step(1, 'Waiting for cluster to start'),
        step(2, localizeFailures ?
          `Error copying notebook to cluster, retry number ${localizeFailures}...` :
          'Copying notebook to cluster')
      ])
    ])
  }
})


export const addNavPaths = () => {
  Nav.defPath('workspace-notebook-launch', {
    path: '/workspaces/:namespace/:name/notebooks/launch/:notebookName',
    component: NotebookLauncher,
    title: ({ name, notebookName }) => `${name} - Notebooks - ${notebookName}`
  })
}
