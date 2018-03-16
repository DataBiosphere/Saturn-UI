import _ from 'lodash'
import { Component, Fragment } from 'react'
import { a, div, h, hh } from 'react-hyperscript-helpers'
import { card, contextBar, link, search, TopBar } from 'src/components/common'
import { breadcrumb, icon } from 'src/components/icons'
import { DataGrid, DataTable } from 'src/components/table'
import * as Ajax from 'src/libs/ajax'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'


const WorkspaceList = hh(class WorkspaceList extends Component {
  constructor(props) {
    super(props)
    this.state = {
      filter: '',
      listView: false,
      itemsPerPage: 12,
      pageNumber: 1,
      workspaces: []
    }
  }

  componentWillMount() {
    Ajax.rawls('workspaces').then(json =>
      this.setState({ workspaces: json })
    )
  }

  render() {
    const { workspaces, filter, listView, itemsPerPage, pageNumber } = this.state

    const dataViewerProps = {
      defaultItemsPerPage: itemsPerPage,
      itemsPerPageOptions: [12, 24, 36, 48],
      onItemsPerPageChanged: n => this.setState({ itemsPerPage: n }),
      initialPage: pageNumber,
      onPageChanged: n => this.setState({ pageNumber: n }),
      dataSource: workspaces.filter(({ workspace: { namespace, name } }) =>
        `${namespace}/${name}`.includes(filter))
    }

    return h(Fragment, [
      TopBar({ title: 'Projects' },
        [
          search({
            wrapperProps: { style: { marginLeft: '2rem', flexGrow: 1, maxWidth: 500 } },
            inputProps: {
              placeholder: 'SEARCH BIOSPHERE',
              onChange: v => this.setState({ filter: v }),
              value: filter
            }
          })
        ]
      ),
      contextBar({}, [
        'PROJECTS', breadcrumb(), 'A - Z',
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
        })
      ]),
      div({ style: { margin: '0 auto', maxWidth: 1000 } }, [
        workspaces.length ?
          listView ?
            DataTable(_.assign({
              tableProps: {
                rowKey: ({ workspace }) => workspace['workspaceId'],
                columns: [
                  {
                    title: 'Workspace', dataIndex: 'workspace', key: 'workspace',
                    render: ({ namespace, name }) =>
                      link({ href: Nav.getLink('workspace', namespace, name) },
                        `${namespace}/${name}`)

                  }
                ]
              }
            }, dataViewerProps)) :
            DataGrid(_.assign({
              renderCard: ({ workspace: { namespace, name, createdBy } }, cardsPerRow) => {
                return a({
                    href: Nav.getLink('workspace', namespace, name),
                    style: {
                      width: `calc(${100 / cardsPerRow}% - 2rem)`, minHeight: 100, margin: '1rem',
                      textDecoration: 'none'
                    }
                  },
                  [
                    card({ style: { height: 100 } }, [
                      div({
                        style: {
                          display: 'flex', flexDirection: 'column',
                          justifyContent: 'space-between',
                          height: '100%'
                        }
                      }, [
                        div({ style: Style.elements.cardTitle }, `${namespace}/${name}`),
                        div({ style: { color: Style.colors.text } }, `Created by: ${createdBy}`)
                      ])
                    ])
                  ])
              }
            }, dataViewerProps)) :
          'Loading!'
      ])
    ])
  }
})

export const addNavPaths = () => {
  Nav.defRedirect({ regex: /^.{0}$/, makePath: () => 'workspaces' })
  Nav.defPath(
    'workspaces',
    {
      component: WorkspaceList,
      regex: /workspaces$/,
      makeProps: () => ({}),
      makePath: () => 'workspaces'
    }
  )
}
