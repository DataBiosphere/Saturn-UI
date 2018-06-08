import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { icon, spinner } from 'src/components/icons'
import { TopBar } from 'src/components/TopBar'
import { Rawls, Leo } from 'src/libs/ajax'
import { getBasicProfile } from 'src/libs/auth'
import { reportError } from 'src/libs/error'
import * as Style from 'src/libs/style'
import * as Nav from 'src/libs/nav'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


const wait = ms => new Promise(resolve => setTimeout(resolve, ms))


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


class NotebookLauncher extends Component {
  async componentDidMount() {
    try {
      const bucketName = await this.resolveBucketName()
      this.setState({ bucketName })
      const cluster = await this.startCluster()
      await this.localizeNotebook(cluster)

      const { name: workspaceName, notebookName } = this.props
      window.location.href = `${cluster.clusterUrl}/notebooks/${workspaceName}/${notebookName}`
    } catch (error) {
      reportError('Error launching notebook', error)
    }
  }

  async resolveBucketName() {
    const { namespace, name: workspaceName } = this.props
    const { workspace: { bucketName } } = await Rawls.workspace(namespace, workspaceName).details()
    return bucketName
  }

  async getCluster() {
    const { namespace } = this.props

    return _.flow(
      _.filter({ googleProject: namespace, creator: getBasicProfile().getEmail() }),
      _.remove({ status: 'Deleting' }),
      _.sortBy('createdDate'),
      _.last
    )(await Leo.clustersList())
  }

  async startCluster() {
    while (true) {
      const cluster = await this.getCluster()
      if (!cluster) {
        throw new Error('No clusters available')
      }

      const { status, googleProject, clusterName } = cluster
      this.setState({ clusterStatus: status })

      if (status === 'Running') {
        return cluster
      } else if (status === 'Stopped') {
        await Leo.cluster(googleProject, clusterName).start()
        await wait(10000)
      } else {
        await wait(3000)
      }
    }
  }

  async localizeNotebook(cluster) {
    const { namespace, name: workspaceName, notebookName } = this.props
    const { bucketName } = this.state
    const { clusterName } = cluster

    await Promise.all([
      Leo.notebooks(namespace, clusterName).setCookie(),
      Leo.notebooks(namespace, clusterName).localize({
        [`~/${workspaceName}/.delocalize.json`]: `data:application/json,{"destination":"gs://${bucketName}/notebooks","pattern":""}`
      })
    ])
    await Leo.notebooks(namespace, clusterName).localize({
      [`~/${workspaceName}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`
    })
  }

  render() {
    const { bucketName, clusterStatus } = this.state

    const currentStep = Utils.cond(
      [!bucketName, () => 0],
      [clusterStatus !== 'Running', () => 1],
      () => 2
    )

    const step = (index, text) => div({ style: styles.step.container }, [
      div({ style: styles.step.col1 }, [
        index < currentStep && icon('check', { size: 24, style: { color: Style.colors.success } }),
        index === currentStep && spinner()
      ]),
      div({ style: styles.step.col2 }, [text])
    ])

    return h(Fragment, [
      h(TopBar, { title: 'Launching Notebook' }),
      div({ style: styles.pageContainer }, [
        div({ style: Style.elements.sectionHeader }, 'Saturn is preparing your notebook'),
        step(0, 'Resolving Google bucket'),
        step(1, 'Waiting for cluster to start'),
        step(2, 'Localizing notebook')
      ])
    ])
  }
}


export const addNavPaths = () => {
  Nav.defPath('workspace-notebook-launch', {
    path: '/workspaces/:namespace/:name/notebooks/launch/:notebookName',
    component: NotebookLauncher
  })
}
