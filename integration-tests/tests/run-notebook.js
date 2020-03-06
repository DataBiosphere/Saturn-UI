const { withRegisteredUser, withBilling, withWorkspace } = require('../utils/integration-helpers')
const { testUrl } = require('../utils/integration-config')
const { click, clickable, signIntoTerra, findElement, waitForNoSpinners, select, fillIn, input, findIframe, findText, dismissNotifications } = require('../utils/integration-utils')


const notebookName = 'TestNotebook'

const testRunNotebookFn = withRegisteredUser(async ({ page, context, email, token }) => {
  await withBilling(withWorkspace(async ({ workspaceName }) => {
    await page.goto(testUrl)
    await click(page, clickable({ textContains: 'View Workspaces' }))
    await signIntoTerra(page, token)
    await dismissNotifications(page)
    await findElement(page, clickable({ textContains: workspaceName }))
    await waitForNoSpinners(page)
    await click(page, clickable({ textContains: workspaceName }))
    await click(page, clickable({ text: 'notebooks' }))
    await click(page, clickable({ textContains: 'Create a' }))
    await fillIn(page, input({ placeholder: 'Enter a name' }), notebookName)
    await select(page, 'Language', 'Python 2')
    await click(page, clickable({ text: 'Create Notebook' }))
    await click(page, clickable({ textContains: notebookName }))
    await click(page, clickable({ text: 'Edit' }))
    await select(page, 'ENVIRONMENT', 'Hail')
    await click(page, clickable({ text: 'Create' }))
    await findElement(page, clickable({ textContains: 'Creating' }))
    await findElement(page, clickable({ textContains: 'Running' }), { timeout: 10 * 60 * 1000 })

    const frame = await findIframe(page)
    await fillIn(frame, '//textarea', 'print(123456789099876543210990+9876543219)')
    await click(frame, clickable({ text: 'Run' }))
    await findText(frame, '123456789099886419754209')
  }))({ context, email, token })
})
const testRunNotebook = {
  name: 'run notebook',
  fn: testRunNotebookFn,
  timeout: 15 * 60 * 1000

}

module.exports = { testRunNotebook }
