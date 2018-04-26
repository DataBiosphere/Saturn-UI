import _ from 'lodash'
import * as Config from 'src/libs/config'
import * as Utils from 'src/libs/utils'


let mockResponse
let noConnection

const consoleStyle = 'font-weight: bold; color: darkBlue'

window.saturnMock = {
  currently: function() {
    if (noConnection || mockResponse) {
      if (noConnection) {console.info('%cSimulating no connection', consoleStyle)}
      if (mockResponse) {
        console.info('%cSimulating response:', consoleStyle)
        console.info(mockResponse())
      }
    } else {
      console.info('%cNot mocking responses', consoleStyle)
    }
  },
  malformed: function() {
    mockResponse = () => new Response('{malformed', { status: 200 })
  },
  noConnection: function() {
    noConnection = true
  },
  off: function() {
    mockResponse = undefined
    noConnection = undefined
  },
  status: function(code) {
    mockResponse = () => new Response(new Blob([`Body of simulated ${code} response`]),
      { status: code })
  }
}

/**
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<Response>}
 */
const ajax = function(url, options = {}) {
  if (noConnection) {
    console.info('%cSimulating no connection', consoleStyle)
    return new Promise(function(resolve, reject) {
      reject(new TypeError('Simulating no connection'))
    })
  } else if (mockResponse) {
    console.info('%cSimulating response:', consoleStyle)
    console.info(mockResponse())
    return new Promise(function(resolve, _) {
      resolve(mockResponse())
    })
  }

  let withAuth = options

  withAuth.headers = _.merge({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + Utils.getAuthToken()
  }, options.headers)

  return fetch(url, withAuth)
}

const ajaxService = {
  call(path, success, failure, options) {
    ajax(`${this.getUrlRoot()}/${path}`, options)
      .then(response => response.ok ? success(response) : response.text().then(failure))
      .catch(failure)
  },

  json(path, success, failure, options) {
    this.call(path, resp => resp.json().then(success), failure, options)
  }
}


const Sam = _.assign({
  getUrlRoot: Config.getSamUrlRoot,

  token(namespace, success, failure) {
    const scopes = [
      'https://www.googleapis.com/auth/devstorage.full_control'
    ]
    this.json(`api/google/user/petServiceAccount/${namespace}/token`, success, failure,
      { method: 'POST', body: JSON.stringify(scopes) })
  }
}, ajaxService)


export const Buckets = _.assign({
    getUrlRoot: () => 'https://www.googleapis.com',

    copyNotebook(namespace, bucket, oldName, newName, success, failure) {
      Sam.token(namespace,
        token => {
          this.call(`storage/v1/b/${bucket}/o/${
              encodeURIComponent(`notebooks/${oldName}.ipynb`)}/copyTo/b/${bucket}/o/${
              encodeURIComponent(`notebooks/${newName}.ipynb`)}`,
            success,
            failure,
            { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
        },
        failure)
    },

    createNotebook(namespace, bucket, name, contents, success, failure) {
      Sam.token(namespace,
        token => {
          this.call(
            `upload/storage/v1/b/${bucket}/o?uploadType=media&name=${
              encodeURIComponent(`notebooks/${name}.ipynb`)}`,
            success,
            failure,
            {
              method: 'POST', headers: {
                'Content-Type': 'application/x-ipynb+json', Authorization: 'Bearer ' + token
              },
              body: JSON.stringify(contents)
            })
        },
        failure)
    },

    deleteNotebook(namespace, bucket, name, success, failure) {
      Sam.token(namespace,
        token => {
          this.call(`storage/v1/b/${bucket}/o/${encodeURIComponent(`notebooks/${name}.ipynb`)}`,
            success,
            failure,
            { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
        },
        failure)
    },

    renameNotebook(namespace, bucket, oldName, newName, success, failure) {
      this.copyNotebook(namespace, bucket, oldName, newName,
        () => this.deleteNotebook(namespace, bucket, oldName, success, failure),
        failure)
    },

    listNotebooks(namespace, bucket, success, failure) {
      Sam.token(namespace,
        token => {
          this.json(`storage/v1/b/${bucket}/o?prefix=notebooks/`,
            res => success(_.filter(res.items, item => item.name.endsWith('.ipynb'))),
            failure,
            { headers: { Authorization: 'Bearer ' + token } })
        },
        failure)
    }
  },
  ajaxService
)


export const Rawls = _.assign({
  getUrlRoot: () => `${Config.getRawlsUrlRoot()}/api`,

  workspacesList(success, failure) {
    this.json('workspaces', success, failure)
  },

  workspaceDetails(namespace, name, success, failure) {
    this.json(`workspaces/${namespace}/${name}`, success, failure)
  },
  workspaceEntities(namespace, name, success, failure) {
    this.json(`workspaces/${namespace}/${name}/entities`, success, failure)
  },
  workspaceEntity(namespace, name, type, success, failure) {
    this.json(`workspaces/${namespace}/${name}/entities/${type}`, success, failure)
  }

}, ajaxService)


export const Leo = _.assign({
  getUrlRoot: Config.getLeoUrlRoot,

  clustersList(success, failure) {
    this.json('api/clusters', success, failure)
  },

  clusterCreate: function(project, name, clusterOptions, success, failure) {
    this.call(`api/cluster/${project}/${name}`, success, failure,
      { method: 'PUT', body: JSON.stringify(clusterOptions) })
  },
  clusterDelete: function(project, name, success, failure) {
    this.call(`api/cluster/${project}/${name}`, success, failure, { method: 'DELETE' })
  },

  localizeNotebooks(project, name, files, success, failure) {
    this.call(`notebooks/${project}/${name}/api/localize`, success, failure,
      { method: 'POST', body: JSON.stringify(files) })
  },

  setCookie(project, name, success, failure) {
    this.call(`notebooks/${project}/${name}/setCookie`, success, failure,
      { credentials: 'include' })
  }
}, ajaxService)
