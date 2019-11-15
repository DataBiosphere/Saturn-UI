const pRetry = require('p-retry')
const { testUrl, workflowName, billingProject } = require('../utils/integration-config')
const { withWorkspace } = require('../utils/integration-helpers')
const { click, clickable, input, findElement, findText, signIntoTerra, waitForNoSpinners, findInGrid } = require('../utils/integration-utils')


const testEntity = { name: 'test_entity_1', entityType: 'test_entity', attributes: { input: 'foo' } }

test('run workflow', withWorkspace(async ({ workspaceName }) => {
  page.setDefaultTimeout(60 * 60 * 1000)

  await page.goto(testUrl)
  await signIntoTerra(page)

  // await page.evaluate((name, billingProject, testEntity) => {
  //   return window.Ajax().Workspaces.workspace(billingProject, name).createEntity(testEntity)
  // }, workspaceName, billingProject, testEntity)

  await click(page, clickable({ textContains: 'View Workspaces' }))
  await click(page, clickable({ textContains: workspaceName }))

  await click(page, clickable({ textContains: 'workflows' }))
  await waitForNoSpinners(page)
  // await click(page, clickable({ textContains: 'Find a Workflow' }))
  // await waitForNoSpinners(page)
  await click(page, clickable({ textContains: workflowName }))
  // await waitForNoSpinners(page)
  // await click(page, clickable({ textContains: 'Add to Workspace' }))

  await waitForNoSpinners(page)
  await click(page, clickable({ textContains: 'Select Data' }))
  await click(page, input({ labelContains: 'Choose specific rows to process' }))
  await click(page, `//*[@role="checkbox" and contains(@aria-label, "${testEntity.name}")]`)
  await click(page, clickable({ textContains: 'OK' }))
  await click(page, clickable({ textContains: 'Run analysis' }))

  await Promise.all([
    page.waitForNavigation(),
    click(page, clickable({ textContains: 'Launch' }))
  ])

  page.screenshot({ path: `screenshots/failure-${workspaceName}.png`, fullPage: true })

  await pRetry(async () => {
    await waitForNoSpinners(page)
    await findInGrid(page, 'Succeeded')
  }, { minTimeout: 15 * 1000, onFailedAttempt: page.reload })
}), 10 * 60 * 1000)
