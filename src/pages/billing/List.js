import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { a, div, h, label } from 'react-hyperscript-helpers'
import { pure } from 'recompose'
import { PageBox, search, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import { textInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import TopBar from 'src/components/TopBar'
import { ajaxCaller } from 'src/libs/ajax'
import { authStore } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import { formLabel } from 'src/libs/forms'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


const ProjectCard = pure(({ project: { projectName, creationStatus, role }, onDelete }) => {
  const isOwner = !!_.includes('Owner', role)
  const projectReady = creationStatus === 'Ready'

  return div({ style: Style.cardList.longCard }, [
    div({ style: { flex: 'none' } }, [
      icon(projectReady ? 'check' : 'bars', {
        style: {
          color: projectReady ? colors.green[0] : undefined,
          marginRight: '1rem'
        }
      }),
      creationStatus
    ]),
    div({ style: { flex: 1 } }, [
      a({
        href: isOwner ? Nav.getLink('project', { projectName }) : undefined,
        style: {
          ...Style.cardList.longTitle,
          marginLeft: '2rem', marginRight: '1rem',
          color: isOwner ? colors.green[0] : undefined
        }
      }, [projectName])
    ]),
    div({ style: { width: 100 } }, [isOwner ? 'Owner' : 'Member'])
  ])
})

const NewAccountForm = ({ onDismiss }) => {
  const [page, setPage] = useState(0)
  const [accountInfo, setAccountInfo] = useState(() => {
    const {firstName, lastName, title, institute} = authStore.get().profile

    return { name: `${firstName} ${lastName}`, title, institute }
  })
  const updateAccountInfo = key => ({ target: { value } }) => setAccountInfo({ ...accountInfo, [key]: value })

  const makeField = (title, key) => label([
    formLabel(title),
    textInput({
      value: accountInfo[key],
      onChange: updateAccountInfo(key)
    })
  ])

  return h(Modal, {
    title: 'New Billing Account',
    onDismiss,
    showButtons: false,
    showX: true,
    width: 800
  }, [
    makeField('Your name', 'name'),
    makeField('Your title', 'title'),
    makeField('Institution name', 'institute'),
    makeField('Billing address', 'billingAddress'),
    makeField('New account name', 'accountName'),
    makeField('Account admin email', 'adminEmail'),
    makeField('Account value', 'accountValue'),
    makeField('Budget alert policy', 'alertPolicy'),
    makeField('Financial contact name', 'financialContactName'),
    makeField('Financial contact email', 'financialContactEmail'),
    makeField('Financial contact phone', 'financialContactPhone')
  ])
}

export const BillingList = ajaxCaller(class BillingList extends Component {
  constructor(props) {
    super(props)
    this.state = {
      filter: '',
      billingProjects: null,
      ...StateHistory.get()
    }
  }

  async refresh() {
    const { ajax: { Billing } } = this.props

    try {
      this.setState({ isDataLoaded: false })
      const rawBillingProjects = await Billing.listProjects()
      const billingProjects = _.flow(
        _.groupBy('projectName'),
        _.map(gs => ({ ...gs[0], role: _.map('role', gs) })),
        _.sortBy('projectName')
      )(rawBillingProjects)
      this.setState({ billingProjects, isDataLoaded: true })
    } catch (error) {
      reportError('Error loading billing projects list', error)
    }
  }

  componentDidMount() {
    this.refresh()
  }

  render() {
    const { billingProjects, isDataLoaded, filter } = this.state
    return h(Fragment, [
      h(TopBar, { title: 'Billing' }, [
        search({
          wrapperProps: { style: { marginLeft: '2rem', flexGrow: 1, maxWidth: 500 } },
          inputProps: {
            placeholder: 'SEARCH BILLING PROJECTS',
            onChange: e => this.setState({ filter: e.target.value }),
            value: filter
          }
        })
      ]),
      h(PageBox, { style: { padding: '1.5rem', flex: 1 } }, [
        div({ style: Style.cardList.toolbarContainer }, [
          div({
            style: {
              ...Style.elements.sectionHeader,
              textTransform: 'uppercase',
              marginBottom: '1rem'
            }
          }, ['Billing Projects Management'])
        ]),
        div({ style: Style.cardList.cardContainer }, [
          div({ style: { flexGrow: 1 } }, [
            _.flow(
              _.filter(({ projectName }) => Utils.textMatch(filter, projectName)),
              _.map(project => {
                return h(ProjectCard, {
                  project, key: `${project.projectName}`
                })
              })
            )(billingProjects)
          ]),
          h(NewAccountForm),
          !isDataLoaded && spinnerOverlay
        ])
      ])

    ])
  }

  componentDidUpdate() {
    StateHistory.update(_.pick(
      ['billingProjects', 'filter'],
      this.state)
    )
  }
})


export const addNavPaths = () => {
  Nav.defPath('billing', {
    path: '/billing',
    component: BillingList,
    title: 'Billing Management'
  })
}
