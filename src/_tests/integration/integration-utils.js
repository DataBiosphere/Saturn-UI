const findClickable = (page, text) => {
  return page.waitForXPath(`(//a | //*[@role="button"])[contains(normalize-space(.),"${text}") or contains(@aria-label,"${text}")]`)
}

const click = async (page, text) => {
  return (await findClickable(page, text)).click()
}

const findText = (page, text) => {
  return page.waitForXPath(`//*[contains(normalize-space(.),"${text}")]`)
}

const findInput = (page, label) => {
  return page.waitForXPath(`(//input | //textarea)[contains(@aria-label,"${label}") or @id=//label[contains(normalize-space(.),"${label}")]/@for]`)
}

const fillIn = async (page, label, text) => {
  return (await findInput(page, label)).type(text, { delay: 20 })
}

const select = async (page, label, text) => {
  (await findInput(page, label)).click()
  return (await page.waitForXPath(`//div[starts-with(@id, "react-select-") and contains(normalize-space(.),"${text}")]`)).click()
}

const waitForNoSpinners = page => {
  return page.waitForXPath('//*[@data-icon="loadingSpinner"]', { hidden: true })
}

const signIntoTerra = async page => {
  await findText(page, 'requires a Google Account')
  await page.evaluate(token => window.forceSignIn(token), process.env.TERRA_TOKEN)
}

const getWorkSpaceName = (prefix) => {
  return `${prefix}-workspace-${Math.floor(Math.random() * 100000)}`
}

const getWorkFlowName = (prefix) => {
  return `${prefix}-workflow-${Math.floor(Math.random() * 100000)}`
}


module.exports = {
  findClickable,
  click,
  findText,
  findInput,
  fillIn,
  select,
  waitForNoSpinners,
  signIntoTerra,
  getWorkSpaceName,
  getWorkFlowName
}
