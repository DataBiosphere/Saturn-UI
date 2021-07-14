import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { store } from 'react-notifications-component'
import { ButtonPrimary, Clickable, IdContainer, Link } from 'src/components/common'
import ErrorView from 'src/components/ErrorView'
import { icon } from 'src/components/icons'
import Modal from 'src/components/Modal'
import colors from 'src/libs/colors'
import { notificationStore } from 'src/libs/state'
import * as StateHistory from 'src/libs/state-history'
import * as Utils from 'src/libs/utils'
import { v4 as uuid } from 'uuid'


// documentation: https://github.com/teodosii/react-notifications-component

export const sessionTimeoutProps = {
  id: 'sessionTimeout',
  detail: 'You have been signed out due to inactivity'
}

const makeNotification = props => _.defaults({ id: uuid() }, props)

export const notify = (type, title, props) => {
  const notification = makeNotification({ type, title, ...props })
  const visibleNotificationIds = _.map('id', notificationStore.get())
  notificationStore.update(Utils.append(notification))
  if (!_.includes(notification.id, visibleNotificationIds)) {
    showNotification(notification)
  }
  return notification.id
}

export const clearNotification = id => store.removeNotification(id)

const NotificationDisplay = ({ id }) => {
  const notificationState = Utils.useStore(notificationStore)
  const [modal, setModal] = useState(false)
  const [notificationNumber, setNotificationNumber] = useState(0)

  const notifications = _.filter(n => n.id === id, notificationState)
  const onFirst = notificationNumber === 0
  const onLast = notificationNumber + 1 === notifications.length

  const { title, message, detail, type } = notifications[notificationNumber]
  const [baseColor, ariaLabel] = Utils.switchCase(type,
    ['success', () => [colors.success, 'success notification']],
    ['info', () => [colors.accent, 'info notification']],
    ['welcome', () => [colors.accent, 'welcome notification']],
    ['warn', () => [colors.warning, 'warning notification']],
    ['error', () => [colors.danger, 'error notification']],
    [Utils.DEFAULT, () => [colors.accent, 'notification']]
  )
  const iconType = Utils.switchCase(type,
    ['success', () => 'success-standard'],
    ['warn', () => 'warning-standard'],
    ['error', () => 'error-standard']
  )

  return h(IdContainer, [labelId => h(IdContainer, [descId => div({
    style: {
      backgroundColor: baseColor(0.15),
      borderRadius: '4px',
      boxShadow: '0 0 4px 0 rgba(0,0,0,0.5)',
      cursor: 'auto',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 12
    },
    role: 'alert',
    'aria-labelledby': labelId,
    'aria-describedby': !!message ? descId : undefined
  }, [
    // content and close button
    div({ style: { display: 'flex', padding: '0.75rem 1rem' } }, [
      // content
      div({ style: { display: 'flex', flex: 1, flexDirection: 'column' } }, [
        // icon and title
        div({ style: { display: 'flex' } }, [
          !!iconType && icon(iconType, {
            'aria-hidden': false, 'aria-label': ariaLabel,
            size: 26,
            style: { color: baseColor(), flexShrink: 0, marginRight: '0.5rem' }
          }),
          div({ id: labelId, style: { fontWeight: 600 } }, [title])
        ]),
        !!message && div({ id: descId, style: { marginTop: '0.5rem' } }, [message]),
        !!detail && h(Clickable, {
          style: { marginTop: '0.25rem', textDecoration: 'underline' },
          onClick: () => setModal(true)
        }, ['Details'])
      ]),
      h(Link, {
        style: { alignSelf: 'start' },
        'aria-label': type ? `Dismiss ${type} notification` : 'Dismiss notification',
        title: 'Dismiss notification',
        onClick: () => store.removeNotification(id)
      }, [icon('times', { size: 20 })])
    ]),
    notifications.length > 1 && div({
      style: { alignItems: 'center', borderTop: `1px solid ${baseColor()}`, display: 'flex', fontSize: 10, padding: '0.75rem 1rem' }
    }, [
      h(Link, {
        disabled: onFirst,
        onClick: () => setNotificationNumber(notificationNumber - 1)
      }, [icon('angle-left', { size: 12 })]),
      div({
        style: {
          backgroundColor: colors.accent(), color: 'white',
          fontWeight: 600,
          borderRadius: 10,
          padding: '0.2rem 0.5rem'
        }
      }, [
        notificationNumber + 1, '/', notifications.length
      ]),
      h(Link, {
        disabled: onLast,
        onClick: () => setNotificationNumber(notificationNumber + 1)
      }, [icon('angle-right', { size: 12 })])
    ]),
    modal && h(Modal, {
      width: 800,
      title,
      showCancel: false,
      showX: true,
      onDismiss: () => setModal(false),
      okButton: h(ButtonPrimary, { onClick: refreshPage }, 'Refresh Page')
    }, [
      h(ErrorView, { error: detail })
    ])
  ])])])
}

const refreshPage = () => {
  StateHistory.clearCurrent()
  document.location.reload()
}

const showNotification = ({ id, timeout }) => {
  store.addNotification({
    id,
    onRemoval: () => notificationStore.update(_.reject({ id })),
    content: div({ style: { width: '100%' } }, [
      h(NotificationDisplay, { id })
    ]),
    container: 'top-right',
    dismiss: { duration: !!timeout ? timeout : 0, click: false, touch: false },
    animationIn: ['animate__animated', 'animate__fadeIn'],
    animationOut: ['animate__animated', 'animate__fadeOut'],
    insert: 'bottom',
    width: 350
  })
}
