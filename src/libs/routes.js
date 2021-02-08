import _ from 'lodash/fp'
import { compile, pathToRegexp } from 'path-to-regexp'
import { routeHandlersStore } from 'src/libs/state'
import * as Projects from 'src/pages/billing/List'
import * as Environments from 'src/pages/Environments'
import * as Group from 'src/pages/groups/Group'
import * as Groups from 'src/pages/groups/List'
import * as HoF from 'src/pages/HoF'
import * as ImportData from 'src/pages/ImportData'
import * as ImportWorkflow from 'src/pages/ImportWorkflow'
import * as LandingPage from 'src/pages/LandingPage'
import * as Code from 'src/pages/library/Code'
import * as Datasets from 'src/pages/library/Datasets'
import * as DataExplorer from 'src/pages/library/datasets/DataExplorer'
import * as Showcase from 'src/pages/library/Showcase'
import * as NotFound from 'src/pages/NotFound'
import * as PrivacyPolicy from 'src/pages/PrivacyPolicy'
import * as Profile from 'src/pages/Profile'
import * as TermsOfService from 'src/pages/TermsOfService'
import * as TestLogin from 'src/pages/TestLogin'
import * as WorkflowsList from 'src/pages/workflows/List'
import * as WorkflowDetails from 'src/pages/workflows/workflow/WorkflowDetails'
import * as WorkspaceList from 'src/pages/workspaces/List'
import * as AppLauncher from 'src/pages/workspaces/workspace/applications/AppLauncher'
import * as Dashboard from 'src/pages/workspaces/workspace/Dashboard'
import * as Data from 'src/pages/workspaces/workspace/Data'
import * as JobHistory from 'src/pages/workspaces/workspace/JobHistory'
import * as CallDetails from 'src/pages/workspaces/workspace/jobHistory/CallDetails'
import * as SubmissionDetails from 'src/pages/workspaces/workspace/jobHistory/SubmissionDetails'
import * as WorkflowDashboard from 'src/pages/workspaces/workspace/jobHistory/WorkflowDashboard'
import * as Notebooks from 'src/pages/workspaces/workspace/Notebooks'
import * as NotebookLauncher from 'src/pages/workspaces/workspace/notebooks/NotebookLauncher'
import * as Workflows from 'src/pages/workspaces/workspace/Workflows'
import * as WorkflowView from 'src/pages/workspaces/workspace/workflows/WorkflowView'


const routes = _.flatten([
  TestLogin.navPaths,
  LandingPage.navPaths,
  WorkspaceList.navPaths,
  WorkflowView.navPaths,
  ImportData.navPaths,
  ImportWorkflow.navPaths,
  PrivacyPolicy.navPaths,
  Dashboard.navPaths,
  Data.navPaths,
  Notebooks.navPaths,
  JobHistory.navPaths,
  SubmissionDetails.navPaths,
  WorkflowDashboard.navPaths,
  CallDetails.navPaths,
  Workflows.navPaths,
  NotebookLauncher.navPaths,
  Profile.navPaths,
  Groups.navPaths,
  Group.navPaths,
  AppLauncher.navPaths,
  TermsOfService.navPaths,
  Code.navPaths,
  DataExplorer.navPaths,
  Datasets.navPaths,
  Showcase.navPaths,
  Projects.navPaths,
  HoF.navPaths,
  Environments.navPaths,
  WorkflowsList.navPaths,
  WorkflowDetails.navPaths,
  NotFound.navPaths // must be last
])

const handlers = _.map(({ path, encode = encodeURIComponent, ...data }) => {
  const keys = [] // mutated by pathToRegexp
  const regex = pathToRegexp(path, keys)
  return {
    regex,
    keys: _.map('name', keys),
    makePath: compile(path, { encode }),
    ...data
  }
}, routes)

// NOTE: This is treated as stateful in order to support hot loading.
// Updates will re-execute this file, which will reset the routes.
routeHandlersStore.set(handlers)
