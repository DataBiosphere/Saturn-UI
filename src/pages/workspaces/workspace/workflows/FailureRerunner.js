import _ from 'lodash/fp'
import { Component } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { icon, spinner } from 'src/components/icons'
import { Ajax } from 'src/libs/ajax'
import { launch } from 'src/libs/analysis'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import { clearNotification, notify } from 'src/libs/notifications'
import { rerunFailuresStatus } from 'src/libs/state'
import * as Utils from 'src/libs/utils'


const ToastMessageComponent = Utils.connectStore(rerunFailuresStatus, 'status')(class ToastMessageComponent extends Component {
  render() {
    const { status: { done, text } } = this.props

    return div({ style: { padding: '0.5rem 0', display: 'flex', alignItems: 'center', fontSize: 14 } }, [
      done ?
        icon('success-standard', { size: 24, style: { color: colors.success(), marginRight: '1rem' } }) :
        spinner({ style: { marginRight: '1rem' } }),
      text
    ])
  }
})

export const rerunFailures = async ({ namespace, name, submissionId, configNamespace, configName, onDone }) => {
  rerunFailuresStatus.set({ text: 'Loading workflow info...' })
  const id = notify('info', h(ToastMessageComponent))

  try {
    const workspace = Ajax().Workspaces.workspace(namespace, name)
    const methodConfig = workspace.methodConfig(configNamespace, configName)

    const [{ workflows, useCallCache, deleteIntermediateOutputFiles }, { rootEntityType }] = await Promise.all([
      workspace.submission(submissionId).get(),
      methodConfig.get()
    ])

    const failedEntities = _.flow(
      _.filter(v => (v.status === 'Aborted' || v.status === 'Failed')),
      _.map('workflowEntity')
    )(workflows)

    const newSetName = Utils.sanitizeEntityName(`${configName}-resubmission-${new Date().toISOString().slice(0, -5)}`)

    await launch({
      config: { namespace: configNamespace, name: configName, rootEntityType },
      entityType: rootEntityType, entityNames: _.map('entityName', failedEntities),
      newSetName, useCallCache, deleteIntermediateOutputFiles,
      onCreateSet: () => rerunFailuresStatus.set({ text: 'Creating set from failures...' }),
      onLaunch: () => rerunFailuresStatus.set({ text: 'Launching new job...' }),
      onSuccess: () => {
        rerunFailuresStatus.set({ text: 'Success!', done: true })
        onDone()
      },
      onFailure: error => {
        clearNotification(id)
        reportError('Error rerunning failed workflows', error)
      }
    })
    Ajax().Metrics.captureEvent(Events.workflowRerun, { ...extractWorkspaceDetails(workspace), success: true, configNamespace, configName })

    await Utils.delay(2000)
  } catch (error) {
    Ajax().Metrics.captureEvent(Events.workflowRerun, { workspaceName: name, workspaceNamespace: namespace, success: false, configNamespace, configName })
    reportError('Error rerunning failed workflows', error)
  } finally {
    clearNotification(id)
  }
}
