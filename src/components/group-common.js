import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { b, div, h, label } from 'react-hyperscript-helpers'
import { ButtonPrimary, Clickable, IdContainer, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common'
import { icon } from 'src/components/icons'
import { AutocompleteTextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { InfoBox } from 'src/components/PopupTrigger'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import { FormLabel } from 'src/libs/forms'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


const styles = {
  suggestionContainer: {
    display: 'flex', alignItems: 'center',
    padding: '0.5rem 1rem',
    margin: '0 -1rem',
    borderBottom: `1px solid ${colors.dark(0.4)}`
  }
}

export const AdminNotifierCheckbox = ({ checked, onChange }) => {
  return div({ style: { marginTop: '0.5rem', display: 'flex', alignItems: 'center' } }, [
    h(LabeledCheckbox, {
      style: { marginRight: '0.25rem' },
      checked, onChange
    }, ['Allow anyone to request access']),
    h(InfoBox, { style: { marginLeft: '0.3rem' } }, [
      'Any user will be able to request to become a member of this group. This will send an email to the group admins.'
    ])
  ])
}

export const NewUserCard = ({ onClick }) => {
  return h(Clickable, {
    style: Style.cardList.shortCreateCard,
    onClick
  }, [
    div(['Add a User']),
    icon('plus-circle', { style: { marginTop: '0.5rem' }, size: 21 })
  ])
}

export const MemberCard = Utils.memoWithName('MemberCard', ({ member: { email, roles }, adminCanEdit, onEdit, onDelete, adminLabel, userLabel }) => {
  const canEdit = adminCanEdit || !_.includes(adminLabel, roles)
  const tooltip = !canEdit && `This user is the only ${adminLabel}`

  return div({
    style: Style.cardList.longCard
  }, [
    div({ style: { flex: '1' } }, [email]),
    div({ style: { flex: '0 0 150px', textTransform: 'capitalize' } }, [_.includes(adminLabel, roles) ? adminLabel : userLabel]),
    div({ style: { flex: 'none' } }, [
      h(TooltipTrigger, { content: tooltip }, [
        h(Link, {
          disabled: !canEdit,
          onClick: canEdit ? onEdit : undefined
        }, ['Edit Role'])
      ]),
      ' | ',
      h(TooltipTrigger, { content: tooltip }, [
        h(Link, {
          disabled: !canEdit,
          onClick: canEdit ? onDelete : undefined
        }, ['Remove'])
      ])
    ])
  ])
})

export const NewUserModal = ({
  addFunction, addUnregisteredUser = false, adminLabel, userLabel,
  title, onSuccess, onDismiss, footer
}) => {
  const [userEmail, setUserEmail] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [confirmAddUser, setConfirmAddUser] = useState(false)
  const [roles, setRoles] = useState([userLabel])
  const [submitError, setSubmitError] = useState(undefined)
  const [busy, setBusy] = useState(false)

  const signal = Utils.useCancellation()

  Utils.useOnMount(() => {
    const loadData = withErrorReporting('Error looking up collaborators', async () => {
      const [shareSuggestions, groups] = await Promise.all([
        Ajax(signal).Workspaces.getShareLog(),
        Ajax(signal).Groups.list()
      ])

      const suggestions = _.flow(
        _.map('groupEmail'),
        _.concat(shareSuggestions),
        _.uniq
      )(groups)

      setSuggestions(suggestions)
    })

    loadData()
  })

  const submit = async () => { // only called by invite and add, which set busy & catch errors
    try {
      await addFunction(roles, userEmail)
      onSuccess()
    } catch (error) {
      if (400 <= error.status && error.status <= 499) {
        setSubmitError((await error.json()).message)
      } else {
        throw error
      }
    }
  }

  const inviteUser = _.flow(
    withErrorReporting('Error adding user'),
    Utils.withBusyState(setBusy)
  )(async () => {
    await Ajax(signal).User.inviteUser(userEmail)
    await submit()
  })

  const addUser = _.flow(
    withErrorReporting('Error adding user'),
    Utils.withBusyState(setBusy)
  )(async () => {
    addUnregisteredUser && !await Ajax(signal).User.isUserRegistered(userEmail) ? setConfirmAddUser(true) : await submit()
  })

  const errors = validate({ userEmail }, { userEmail: { email: true } })
  const isAdmin = _.includes(adminLabel, roles)

  const userEmailInvalid = !!validate({ userEmail }, { userEmail: { email: true } })
  const canAdd = value => value !== userEmail || !userEmailInvalid

  return Utils.cond(
    [confirmAddUser, () => h(Modal, {
      title: 'User is not registered',
      okButton: h(ButtonPrimary, { onClick: inviteUser }, ['Yes']),
      cancelText: 'No',
      onDismiss: () => setConfirmAddUser(false)
    }, ['Add ', b(userEmail), ' to the group anyway?', busy && spinnerOverlay])],
    () => h(Modal, {
      onDismiss,
      title,
      okButton: h(ButtonPrimary, {
        tooltip: Utils.summarizeErrors(errors),
        onClick: () => addUser(),
        disabled: errors
      }, ['Add User'])
    }, [
      h(IdContainer, [id => h(Fragment, [
        h(FormLabel, { htmlFor: id, required: true }, ['User email']),
        h(AutocompleteTextInput, {
          id,
          autoFocus: true,
          openOnFocus: false,
          value: userEmail,
          onChange: setUserEmail,
          renderSuggestion: suggestion => div({ style: styles.suggestionContainer }, [
            div({ style: { flex: 1 } }, [
              !canAdd(suggestion) && h(TooltipTrigger, {
                content: 'Not a valid email address'
              }, [
                icon('warning-standard', { style: { color: colors.danger(), marginRight: '0.5rem' } })
              ]),
              suggestion
            ])
          ]),
          suggestions: [...(!!userEmail && !suggestions.includes(userEmail) ? [userEmail] : []), ...suggestions],
          style: { fontSize: 16 },
          type: undefined
        })
      ])]),
      h(FormLabel, ['Role']),
      h(LabeledCheckbox, {
        checked: isAdmin,
        onChange: () => setRoles([isAdmin ? userLabel : adminLabel])
      }, [
        label({ style: { margin: '0 2rem 0 0.25rem' } }, [`Can manage users (${adminLabel})`])
      ]),
      footer && div({ style: { marginTop: '1rem' } }, [footer]),
      submitError && div({ style: { marginTop: '0.5rem', textAlign: 'right', color: colors.danger() } }, [submitError]),
      busy && spinnerOverlay
    ])
  )
}

export const EditUserModal = ({ adminLabel, userLabel, user: { email, roles }, onSuccess, onDismiss, saveFunction }) => {
  const [isAdmin, setIsAdmin] = useState(_.includes(adminLabel, roles))
  const [submitting, setSubmitting] = useState(false)

  const submit = _.flow(
    Utils.withBusyState(setSubmitting),
    withErrorReporting('Error updating user')
  )(async () => {
    const applyAdminChange = _.flow(
      _.without([isAdmin ? userLabel : adminLabel]),
      _.union([isAdmin ? adminLabel : userLabel])
    )

    await saveFunction(email, roles, applyAdminChange(roles))
    onSuccess()
  })

  return h(Modal, {
    onDismiss,
    title: 'Edit Roles',
    okButton: h(ButtonPrimary, {
      onClick: () => submit()
    }, ['Change Role'])
  }, [
    div({ style: { marginBottom: '0.25rem' } }, [
      'Edit role for ',
      b([email])
    ]),
    h(LabeledCheckbox, {
      checked: isAdmin,
      onChange: () => setIsAdmin(!isAdmin)
    }, [
      label({ style: { margin: '0 2rem 0 0.25rem' } }, [`Can manage users (${adminLabel})`])
    ]),
    submitting && spinnerOverlay
  ])
}

export const DeleteUserModal = ({ onDismiss, onSubmit, userEmail }) => {
  return h(Modal, {
    onDismiss,
    title: 'Confirm',
    okButton: h(ButtonPrimary, {
      onClick: onSubmit
    }, ['Remove'])
  }, [
    div(['Are you sure you want to remove']),
    b(`${userEmail}?`)
  ])
}
