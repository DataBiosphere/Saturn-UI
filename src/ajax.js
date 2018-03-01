import update from 'immutability-helper'
import * as utils from './utils'


const ajax = function(url, options = { headers: {} }) {
  options.headers = update({
      'Content-Type': 'application/json',
      'Authorization': 'bearer ' + utils.getUser().getAuthResponse().access_token
    },
    { $merge: options.headers })

  return fetch(url, options).then(response => response.json())
}

export { ajax }
