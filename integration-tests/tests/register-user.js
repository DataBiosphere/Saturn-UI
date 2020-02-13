const { testUrl } = require('../utils/integration-config')
const { withUser } = require('../utils/integration-helpers')
const { findText, click, clickable, dismissNotifications, fillIn, input, signIntoTerra, waitForNoSpinners } = require('../utils/integration-utils')


const testRegisterUserFn = withUser(async ({ page, token }) => {
  await page.goto(testUrl)
  await click(page, clickable({ textContains: 'View Workspaces' }))
  await signIntoTerra(page, token)
  await dismissNotifications(page)
  await fillIn(page, input({ labelContains: 'First Name' }), 'Integration')
  await fillIn(page, input({ labelContains: 'Last Name' }), 'Test')
  await click(page, clickable({ textContains: 'Register' }))
  await click(page, clickable({ textContains: 'Accept' }))
  await findText(page, 'To get started, click Create a New Workspace')
})

const testRegisterUser = {
  name: 'register user',
  fn: testRegisterUserFn
}

module.exports = { testRegisterUser }
