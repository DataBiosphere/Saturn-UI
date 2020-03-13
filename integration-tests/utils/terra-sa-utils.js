const _ = require('lodash/fp')
const { JWT } = require('google-auth-library')
const { userEmail, terraSaKeyJson } = require('../utils/integration-config')


const makeAuthClient = _.memoize((subject, { client_email, private_key }) => {
  return new JWT({
    email: client_email,
    scopes: ['profile', 'email', 'openid'],
    subject,
    key: private_key
  })
})

const getToken = async (subject, key) => {
  const { token } = await makeAuthClient(subject, key).getAccessToken()
  return token
}

const withUserToken = testFn => async options => {
  const token = await getToken(userEmail, JSON.parse(terraSaKeyJson))
  return testFn({ ...options, token })
}

module.exports = {
  getToken,
  withUserToken
}
