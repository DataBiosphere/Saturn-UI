import _ from 'lodash/fp'
import { Fragment } from 'react'
import { b, div, h } from 'react-hyperscript-helpers'
import { pure } from 'recompose'
import { buttonPrimary, Clickable, link, PageFadeBox, RadioButton, search, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import { textInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import TooltipTrigger from 'src/components/TooltipTrigger'
import TopBar from 'src/components/TopBar'
import { ajaxCaller } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Forms from 'src/libs/forms'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import { styles } from 'src/pages/groups/common'
import validate from 'validate.js'


const roleSelector = ({ role, updateState }) => h(Fragment, [
  h(RadioButton, {
    text: 'Admin', checked: role === 'admin',
    labelStyle: { margin: '0 2rem 0 0.25rem' },
    onChange: () => updateState('admin')
  }),
  h(RadioButton, {
    text: 'Member', checked: role === 'member',
    labelStyle: { margin: '0 2rem 0 0.25rem' },
    onChange: () => updateState('member')
  })
])


const NewUserModal = ajaxCaller(class NewUserModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      userEmail: '',
      role: 'member'
    }
  }

  render() {
    const { onDismiss } = this.props
    const { userEmail, role, submitting, submitError } = this.state

    const errors = validate({ userEmail }, { userEmail: { email: true } })

    return h(Modal, {
      onDismiss,
      title: 'Add user to Terra Group',
      okButton: buttonPrimary({
        tooltip: Utils.summarizeErrors(errors),
        onClick: () => this.submit(),
        disabled: errors
      }, ['Add User'])
    }, [
      Forms.requiredFormLabel('User email'),
      textInput({
        autoFocus: true,
        value: userEmail,
        onChange: e => this.setState({ userEmail: e.target.value, emailTouched: true })
      }),
      Forms.requiredFormLabel('Role'),
      roleSelector({ role, updateState: role => this.setState({ role }) }),
      submitError && div({ style: { marginTop: '0.5rem', textAlign: 'right', color: colors.red[0] } }, [submitError]),
      submitting && spinnerOverlay
    ])
  }

  async submit() {
    const { groupName, onSuccess, ajax: { Groups } } = this.props
    const { userEmail, role } = this.state

    try {
      this.setState({ submitting: true })
      await Groups.group(groupName).addMember(role, userEmail)
      onSuccess()
    } catch (error) {
      this.setState({ submitting: false })
      if (400 <= error.status <= 499) {
        this.setState({ submitError: (await error.json()).message })
      } else {
        reportError('Error adding user', error)
      }
    }
  }
})

const EditUserModal = ajaxCaller(class EditUserModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      role: props.user.role
    }
  }

  render() {
    const { onDismiss, user: { email } } = this.props
    const { role, submitting } = this.state

    return h(Modal, {
      onDismiss,
      title: 'Edit Roles',
      okButton: buttonPrimary({
        onClick: () => this.submit()
      }, ['Change Role'])
    }, [
      div({ style: { marginBottom: '0.25rem' } }, [
        'Edit role for ',
        b([email])
      ]),
      roleSelector({ role, updateState: role => this.setState({ role }) }),
      submitting && spinnerOverlay
    ])
  }

  async submit() {
    const { groupName, user: { email }, onSuccess, ajax: { Groups } } = this.props
    const { role } = this.state

    try {
      this.setState({ submitting: true })
      await Groups.group(groupName).changeMemberRole(email, this.props.user.role, role)
      onSuccess()
    } catch (error) {
      this.setState({ submitting: false })
      reportError('Error updating user', error)
    }
  }
})

const DeleteUserModal = pure(({ onDismiss, onSubmit, userEmail }) => {
  return h(Modal, {
    onDismiss,
    title: 'Confirm',
    okButton: buttonPrimary({
      onClick: onSubmit
    }, ['Remove'])
  }, [
    div(['Are you sure you want to remove']),
    b(`${userEmail}?`)
  ])
})

const MemberCard = pure(({ member: { email, role }, adminCanEdit, onEdit, onDelete }) => {
  const canEdit = adminCanEdit || role === 'member'
  const tooltip = !canEdit && 'This user is the only admin of this group'

  return div({
    style: styles.longCard
  }, [
    div({ style: { flex: '1' } }, [email]),
    div({ style: { flex: '0 0 150px', textTransform: 'capitalize' } }, [role]),
    div({ style: { flex: 'none' } }, [
      h(TooltipTrigger, { content: tooltip }, [
        link({
          disabled: !canEdit,
          onClick: canEdit ? onEdit : undefined
        }, ['Edit Role'])
      ]),
      ' | ',
      h(TooltipTrigger, { content: tooltip }, [
        link({
          disabled: !canEdit,
          onClick: canEdit ? onDelete : undefined
        }, ['Remove'])
      ])
    ])
  ])
})

const NewUserCard = pure(({ onClick }) => {
  return h(Clickable, {
    style: styles.shortCreateCard,
    onClick
  }, [
    div(['Add a User']),
    icon('plus-circle', { style: { marginTop: '0.5rem' }, size: 21 })
  ])
})

export const GroupDetails = ajaxCaller(class GroupDetails extends Component {
  constructor(props) {
    super(props)
    this.state = {
      filter: '',
      members: null,
      creatingNewUser: false,
      editingUser: false,
      deletingUser: false,
      updating: false,
      ...StateHistory.get()
    }
  }

  async refresh() {
    const { groupName, ajax: { Groups } } = this.props

    try {
      this.setState({ loading: true, creatingNewUser: false, editingUser: false, deletingUser: false, updating: false })

      // TODO: Replace when switching back to SAM for groups api
      const { membersEmails, adminsEmails } = await Groups.group(groupName).listMembers()

      this.setState({
        members: _.sortBy(member => member.email.toUpperCase(), _.concat(
          _.map(adm => ({ email: adm, role: 'admin' }), adminsEmails),
          _.map(mem => ({ email: mem, role: 'member' }), membersEmails)
        )),
        adminCanEdit: adminsEmails.length > 1
      })
    } catch (error) {
      reportError('Error loading group list', error)
    } finally {
      this.setState({ loading: false })
    }
  }

  componentDidMount() {
    this.refresh()
  }

  render() {
    const { members, adminCanEdit, loading, filter, creatingNewUser, editingUser, deletingUser, updating } = this.state
    const { groupName, ajax: { Groups } } = this.props

    return h(Fragment, [
      h(TopBar, { title: 'Groups', href: Nav.getLink('groups') }, [
        search({
          wrapperProps: { style: { marginLeft: '2rem', flexGrow: 1, maxWidth: 500 } },
          inputProps: {
            placeholder: 'SEARCH GROUP',
            onChange: e => this.setState({ filter: e.target.value }),
            value: filter
          }
        })
      ]),
      h(PageFadeBox, [
        div({ style: styles.toolbarContainer }, [
          div({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase' } }, [
            `Group Management: ${groupName}`
          ])
        ]),
        div({ style: styles.cardContainer }, [
          h(NewUserCard, {
            onClick: () => this.setState({ creatingNewUser: true })
          }),
          div({ style: { flexGrow: 1 } },
            _.map(member => {
              return h(MemberCard, {
                member, adminCanEdit,
                onEdit: () => this.setState({ editingUser: member }),
                onDelete: () => this.setState({ deletingUser: member })
              })
            }, _.filter(({ email }) => Utils.textMatch(filter, email), members))
          ),
          loading && spinnerOverlay
        ]),
        creatingNewUser && h(NewUserModal, {
          groupName,
          onDismiss: () => this.setState({ creatingNewUser: false }),
          onSuccess: () => this.refresh()
        }),
        editingUser && h(EditUserModal, {
          user: editingUser, groupName,
          onDismiss: () => this.setState({ editingUser: false }),
          onSuccess: () => this.refresh()
        }),
        deletingUser && h(DeleteUserModal, {
          userEmail: deletingUser.email,
          onDismiss: () => this.setState({ deletingUser: false }),
          onSubmit: async () => {
            try {
              this.setState({ updating: true, deletingUser: false })
              await Groups.group(groupName).removeMember(deletingUser.role, deletingUser.email)
              this.refresh()
            } catch (error) {
              this.setState({ updating: false })
              reportError('Error removing member from group', error)
            }
          }
        }),
        updating && spinnerOverlay
      ])
    ])
  }

  componentDidUpdate() {
    StateHistory.update(_.pick(
      ['members', 'filter'],
      this.state)
    )
  }
})


export const addNavPaths = () => {
  Nav.defPath('group', {
    path: '/groups/:groupName',
    component: GroupDetails,
    title: ({ groupName }) => `Group Management - ${groupName}`
  })
}
