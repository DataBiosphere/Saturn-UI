import _ from 'lodash'
import mixinDeep from 'mixin-deep'
import { a, div, hh } from 'react-hyperscript-helpers'
import { buttonPrimary, link, textInput } from 'src/components/common'
import { icon, spinner } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { DataTable } from 'src/components/table'
import { Buckets, Leo } from 'src/libs/ajax'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component, Fragment, Select } from 'src/libs/wrapped-components'


const baseNotebook = {
  'cells': [
    { 'cell_type': 'code', 'execution_count': null, 'metadata': {}, 'outputs': [], 'source': [] }
  ], 'nbformat': 4, 'nbformat_minor': 2
}

const python2Notebook = _.merge({
  'metadata': {
    'kernelspec': { 'display_name': 'Python 2', 'language': 'python', 'name': 'python2' }
  }
}, baseNotebook)

const python3Notebook = _.merge({
  'metadata': {
    'kernelspec': { 'display_name': 'Python 3', 'language': 'python', 'name': 'python3' }
  }
}, baseNotebook)

const rNotebook = _.merge({
  'metadata': {
    'kernelspec': { 'display_name': 'R', 'language': 'R', 'name': 'ir' },
    'language_info': {
      'codemirror_mode': 'r', 'file_extension': '.r', 'mimetype': 'text/x-r-source', 'name': 'R',
      'pygments_lexer': 'r', 'version': '3.3.3'
    }
  }
}, baseNotebook)

const NotebookCreator = class extends Component {
  render() {
    const { modalOpen, notebookName, notebookKernel, notebookFailure } = this.state
    const { reloadList, bucketName } = this.props

    return Fragment([
      buttonPrimary({
          onClick: () => this.setState(
            { modalOpen: true, notebookName: '', notebookKernel: null }),
          style: { marginLeft: '1rem' }
        },
        'New Notebook'),
      Utils.cond(
        [
          notebookFailure,
          () => Modal({
            title: 'Notebook Creation Failure',
            okButton: buttonPrimary({ onClick: () => this.setState({ notebookFailure: null }) },
              'Done'),
            showCancel: false
          }, notebookFailure)
        ],
        [
          modalOpen,
          () => Modal({
            onDismiss: () => this.setState({ modalOpen: false }),
            title: 'Create New Notebook',
            okButton: buttonPrimary({
              disabled: !(notebookName && notebookKernel),
              onClick: () => {
                this.setState({ creating: true })
                Buckets.createNotebook(bucketName, notebookName, notebookKernel.data,
                  () => {
                    this.setState({ modalOpen: false })
                    reloadList()
                  },
                  notebookFailure => this.setState({ notebookFailure, modalOpen: false }))
              }
            }, 'Create Notebook')
          }, [
            div({ style: Style.elements.sectionHeader }, 'Name'),
            textInput({
              style: { margin: '0.5rem 0 1rem' },
              autoFocus: true,
              placeholder: 'Enter a name',
              value: notebookName,
              onChange: e => this.setState({ notebookName: e.target.value })
            }),
            div({ style: Style.elements.sectionHeader }, 'Kernel'),
            Select({
              clearable: false,
              searchable: false,
              wrapperStyle: { marginTop: '0.5rem' },
              placeholder: 'Select a kernel',
              value: notebookKernel,
              onChange: notebookKernel => this.setState({ notebookKernel }),
              options: [
                {
                  value: 'python2',
                  label: 'Python 2',
                  data: python2Notebook
                },
                {
                  value: 'python3',
                  label: 'Python 3',
                  data: python3Notebook
                },
                {
                  value: 'r',
                  label: 'R',
                  data: rNotebook
                }
              ]
            })
          ])
        ],
        null
      )
    ])
  }
}

const WrappedNotebookCreator = hh(NotebookCreator)


export default hh(class WorkspaceNotebooks extends Component {
  componentWillMount() {
    this.loadClusters()
  }

  loadClusters() {
    this.setState({ clusters: undefined })
    Leo.clustersList(
      list => {
        const owned = _.filter(list,
          v => (v.creator === Utils.getUser().getBasicProfile().getEmail()))
        this.setState({ clusters: _.sortBy(owned, 'clusterName') },
          this.getNotebooks)
      },
      listFailure => this.setState({ listFailure })
    )
  }

  createCluster() {
    Leo.clusterCreate(this.props.workspace.namespace, window.prompt('Name for the new cluster'),
      {
        'labels': {}, 'machineConfig': {
          'numberOfWorkers': 0, 'masterMachineType': 'n1-standard-4',
          'masterDiskSize': 500, 'workerMachineType': 'n1-standard-4',
          'workerDiskSize': 500, 'numberOfWorkerLocalSSDs': 0,
          'numberOfPreemptibleWorkers': 0
        }
      },
      () => {
        this.setState({ creatingCluster: false })
        this.loadClusters()
      },
      creationFail => window.alert(
        `Couldn't create cluster: ${creationFail}`))
    this.setState({ creatingCluster: true })
  }

  getNotebooks() {
    this.setState({ notebooks: undefined, notebookAccess: {} })
    const { workspace } = this.props

    Buckets.listNotebooks(workspace.bucketName,
      notebooks => {
        const cluster = _.first(this.state.clusters).clusterName

        this.setState({ notebooks: _.reverse(_.sortBy(notebooks, 'updated')) })

        _.forEach(notebooks, ({ bucket, name }) => {
          Leo.localizeNotebooks(workspace.namespace, cluster, {
              [`~/${workspace.name}/${name.slice(10)}`]: `gs://${bucket}/${name}`
            },
            () => this.setState(
              oldState => mixinDeep({ notebookAccess: { [name]: true } }, oldState)),
            () => this.setState(
              oldState => mixinDeep({ notebookAccess: { [name]: false } }, oldState))
          )
        })
      },
      notebooksFailure => this.setState({ notebooksFailure })
    )
  }

  renderNotebooks() {
    const { clusters, notebooks, notebookAccess, listView } = this.state
    const { workspace } = this.props

    return div({ style: { display: listView ? undefined : 'flex' } },
      _.map(notebooks, ({ name, updated }) => {
        const printName = name.slice(10, -6) // removes 'notebooks/' and the .ipynb suffix

        const jupyterIcon = icon('jupyterIcon', {
          style: listView ? {
              height: '2em',
              width: '2em',
              margin: '-0.5em 0.5rem -0.5em 0',
              color: Style.colors.background
            } :
            {
              height: 125,
              width: 'auto',
              color: Style.colors.background
            }
        })

        const title = div({
          style: _.defaults(notebookAccess[name] ? {} : { color: Style.colors.disabled },
            Style.elements.cardTitle)
        }, printName)

        const statusIcon = Utils.cond(
          [notebookAccess[name] === false, () => icon('times', { title: 'Error' })],
          [notebookAccess[name], () => icon('check', { title: 'Ready' })],
          () => spinner({ size: undefined, style: undefined, title: 'Transferring to cluster' })
        )

        return a({
            target: '_blank',
            href: notebookAccess[name] ?
              `${_.first(clusters).clusterUrl}/notebooks/${workspace.name}/${name.slice(10)}` : // removes 'notebooks/'
              undefined,
            style: _.defaults({
              width: listView ? undefined : 200,
              height: listView ? undefined : 250,
              margin: '1.25rem', boxSizing: 'border-box',
              color: Style.colors.text, textDecoration: 'none',
              cursor: !notebookAccess[name] ? 'not-allowed' : undefined,
              display: 'flex', flexDirection: listView ? 'row' : 'column',
              justifyContent: listView ? undefined : 'space-between',
              alignItems: listView ? 'center' : undefined
            }, Style.elements.card)
          },
          listView ? [
              jupyterIcon,
              title,
              div({ style: { flexGrow: 1 } }),
              div({ style: { fontSize: '0.8rem', marginRight: '0.5rem' } },
                `Last changed: ${Utils.makePrettyDate(updated)}`),
              statusIcon
            ] :
            [
              title,
              jupyterIcon,
              div({ style: { display: 'flex', alignItems: 'flex-end' } }, [
                div({ style: { fontSize: '0.8rem', flexGrow: 1, marginRight: '0.5rem' } }, [
                  'Last changed:',
                  div({}, Utils.makePrettyDate(updated))
                ]),
                statusIcon
              ])
            ])
      })
    )
  }

  render() {
    const {
      clusters, creatingCluster, listFailure, notebooks, notebooksFailure, listView
    } = this.state

    const { bucketName } = this.props.workspace

    return div({ style: { margin: '1rem' } }, [
      div({ style: { display: 'flex', alignItems: 'center' } }, [
        div(
          { style: { fontSize: 16, fontWeight: 500, color: Style.colors.title, flexGrow: 1 } },
          'CLUSTERS'),
        buttonPrimary({
          style: { display: 'flex' },
          disabled: creatingCluster,
          onClick: () => this.createCluster()
        }, creatingCluster ?
          [
            spinner({ size: '1em', style: { color: 'white', marginRight: '1em' } }),
            'Creating cluster...'
          ] :
          'New cluster')
      ]),
      Utils.cond(
        [listFailure, () => `Couldn't load cluster list: ${listFailure}`],
        [!clusters, spinner],
        () => Fragment([
          DataTable({
            allowPagination: false,
            dataSource: clusters,
            tableProps: {
              rowKey: 'clusterName',
              columns: [
                {
                  title: 'Cluster Name', key: 'clusterName',
                  render: ({ clusterName, clusterUrl, status, creator }) => {
                    const isAccessible = creator === Utils.getUser().getBasicProfile().getEmail() &&
                      status === 'Running'
                    return link({
                      title: clusterName,
                      disabled: !isAccessible,
                      href: isAccessible ? clusterUrl : undefined,
                      target: '_blank',
                      style: {
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                        overflow: 'hidden', width: 400
                      }
                    }, clusterName)
                  }
                },
                { title: 'Google project', dataIndex: 'googleProject', key: 'googleProject' },
                { title: 'Status', dataIndex: 'status', key: 'status' },
                {
                  title: 'Created', dataIndex: 'createdDate', key: 'createdDate',
                  render: Utils.makePrettyDate
                },
                {
                  title: 'Created by', dataIndex: 'creator', key: 'creator',
                  render: creator => div({
                    title: creator,
                    style: {
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                      overflow: 'hidden'
                    }
                  }, creator)
                },
                {
                  title: 'Delete', key: 'delete',
                  render: ({ clusterName, googleProject, status }) => {
                    if (status !== 'Deleting') {
                      return link({
                        onClick: () => {
                          Leo.clusterDelete(googleProject, clusterName,
                            () => this.loadClusters(),
                            deletionFail => window.alert(`Couldn't delete cluster: ${deletionFail}`)
                          )
                        },
                        title: `Delete cluster ${clusterName}`
                      }, [icon('trash', { style: { margin: 'auto', display: 'block' } })])
                    }
                  }
                }
              ]
            }
          }),
          div({
            style: {
              color: Style.colors.title, marginTop: '2rem', display: 'flex', alignItems: 'center'
            }
          }, [
            div({ style: { fontSize: 16, fontWeight: 500 } }, 'NOTEBOOKS'),
            div({ style: { flexGrow: 1 } }),
            icon('view-cards', {
              style: {
                cursor: 'pointer', boxShadow: listView ? null : `0 4px 0 ${Style.colors.highlight}`,
                marginRight: '1rem', width: 26, height: 22
              },
              onClick: () => {
                this.setState({ listView: false })
              }
            }),
            icon('view-list', {
              style: {
                cursor: 'pointer', boxShadow: listView ? `0 4px 0 ${Style.colors.highlight}` : null
              },
              size: 26,
              onClick: () => {
                this.setState({ listView: true })
              }
            }),
            WrappedNotebookCreator(
              { reloadList: () => this.getNotebooks(), bucketName })
          ]),
          Utils.cond(
            [notebooksFailure, () => `Couldn't load cluster list: ${notebooksFailure}`],
            [!notebooks, spinner],
            () => this.renderNotebooks()
          )
        ])
      )
    ])
  }
})
