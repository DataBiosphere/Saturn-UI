import { useEffect } from 'react'
import { Ajax } from 'src/libs/ajax'
import { useRoute } from 'src/libs/nav'
import { authStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'


const eventsList = {
  applicationLaunch: 'application:launch',
  notebookLaunch: 'notebook:launch',
  notebookRename: 'notebook:rename',
  notebookCopy: 'notebook:copy',
  pageView: 'page:view',
  workflowImport: 'workflow:import',
  workflowLaunch: 'workflow:launch',
  workflowRerun: 'workflow:rerun',
  workspaceClone: 'workspace:clone',
  workspaceCreate: 'workspace:create',
  workspaceDataImport: 'workspace:data:import',
  workspaceShare: 'workspace:share'
}

export const extractWorkspaceDetails = workspaceObject => {
  const { workspace: { namespace, name } } = workspaceObject
  return { workspaceName: name, workspaceNamespace: namespace }
}

export const extractCrossWorkspaceDetails = (fromWorkspace, toWorkspace) => {
  return {
    fromWorkspaceNamespace: fromWorkspace.workspace.namespace,
    fromWorkspaceName: fromWorkspace.workspace.name,
    toWorkspaceNamespace: toWorkspace.workspace.namespace,
    toWorkspaceName: toWorkspace.workspace.name
  }
}

export const PageViewReporter = () => {
  const { name } = useRoute()
  const { isSignedIn, registrationStatus } = Utils.useStore(authStore)

  useEffect(() => {
    if (isSignedIn && registrationStatus === 'registered') {
      Ajax().Metrics.captureEvent(`${eventsList.pageView}:${name}`)
    }
  }, [isSignedIn, name, registrationStatus])

  return null
}

export default eventsList
