import { createRef, Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { Clickable, buttonPrimary, Select, spinnerOverlay, link } from 'src/components/common'
import { icon } from 'src/components/icons'
import { TextArea, textInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { Ajax } from 'src/libs/ajax'
import { authStore } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Forms from 'src/libs/forms'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import validate from 'validate.js'
import Dropzone from 'react-dropzone'


const constraints = {
  name: { presence: { allowEmpty: false } },
  subject: { presence: { allowEmpty: false } },
  description: { presence: { allowEmpty: false } },
  email: { email: true, presence: { allowEmpty: false } }
}

// If you are making changes to the Support Request Modal, make sure you test the following:
// 1. Submit a ticket via Terra while signed in and signed out
// 2. Check the tickets are generated on Zendesk
// 3. Reply internally (as a Light Agent) and make sure an email is not sent
// 4. Reply externally (ask one of the Comms team with Full Agent access) and make sure you receive an email

const SupportRequestModal = Utils.connectAtom(authStore, 'authState')(class SupportRequestModal extends Component {
  constructor(props) {
    super(props)
    const { contactEmail, email } = props.authState.profile

    this.state = {
      subject: '',
      description: '',
      type: 'question',
      email: contactEmail || email || '',
      nameEntered: ''
    }
    this.uploader = createRef()
  }

  hasName() {
    const { authState: { profile: { firstName } } } = this.props
    return !(firstName === 'N/A' || firstName === undefined)
  }

  async uploadFile(files) {
    console.log(files[0])
    await Ajax().User.uploadAttachment(files[0])
  }

  getRequest() {
    const { authState: { profile: { firstName, lastName } } } = this.props
    const { nameEntered, email, description, subject, type } = this.state
    //const attachmentToken = this.uploadFile()

    return {
      name: this.hasName() ? `${firstName} ${lastName}` : nameEntered,
      email,
      description,
      subject,
      type,
      //attachmentToken
    }
  }

  render() {
    const { onDismiss, authState: { profile: { firstName } } } = this.props
    const { submitting, submitError, subject, description, type, email, nameEntered } = this.state
    const greetUser = this.hasName() ? `, ${firstName}` : ''
    const errors = validate(this.getRequest(), constraints)

    return h(Dropzone, {
      maxSize: 20 * 1024 * 1024,
      disableClick: true,
      activeStyle: { backgroundColor: colors.blue[3], cursor: 'copy' },
      acceptStyle: { backgroundColor: colors.green[3], cursor: 'copy' },
      rejectStyle: { backgroundColor: colors.red[3], cursor: 'no-drop' },
      ref: this.uploader,
      onDropRejected: e => reportError('Error uploading attachment', e),
      onDropAccepted: file => this.uploadFile(file)
    }, [
      h(Modal, {
        onDismiss,
        title: 'Contact Us',
        okButton: buttonPrimary({
          disabled: errors,
          tooltip: Utils.summarizeErrors(errors),
          onClick: () => this.submit()
        }, ['SEND'])
      }, [
        !this.hasName() && h(Fragment, [
          Forms.requiredFormLabel('Name'),
          textInput({
            placeholder: 'What should we call you?',
            autoFocus: true,
            value: nameEntered,
            onChange: e => this.setState({ nameEntered: e.target.value })
          })
        ]),
        Forms.requiredFormLabel('Type'),
        h(Select, {
          isMulti: false,
          value: type,
          onChange: ({ value }) => this.setState({ type: value }),
          options: [{ value: 'question', label: 'Question' }, { value: 'bug', label: 'Bug' }, { value: 'feature_request', label: 'Feature Request' }]
        }),
        Forms.requiredFormLabel(`How can we help you${greetUser}?`),
        textInput({
          style: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomStyle: 'dashed' },
          placeholder: 'Enter a subject',
          autoFocus: this.hasName(),
          value: subject,
          onChange: e => this.setState({ subject: e.target.value })
        }),
        h(TextArea, {
          style: { height: 200, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopStyle: 'dashed' },
          placeholder: 'Enter a description',
          value: description,
          onChange: e => this.setState({ description: e.target.value })
        }),
        Forms.formLabel('Attachments'),
        h(Clickable, {
          style: {
            flex: 1, backgroundColor: colors.gray[5], borderRadius: 5,
            border: `1px dashed ${colors.gray[2]}`
          },
          onClick: () => this.uploader.current.open()
        }, [
          div({ style: { fontSize: 14, lineHeight: '30px', paddingLeft: '1rem' } }, [
            'Drag or ', link({}, ['Click']), ' to add an attachment    ',
            icon('upload-cloud', { size: 25, style: { opacity: 0.4 } })
          ])
        ]),

        Forms.requiredFormLabel('Contact email'),
        textInput({
          value: email,
          placeholder: 'Enter your email address',
          onChange: e => this.setState({ email: e.target.value })
        }),
        submitError && div({ style: { marginTop: '0.5rem', textAlign: 'right', color: colors.red[0] } }, [submitError]),
        submitting && spinnerOverlay
      ])
    ])
  }

  async submit() {
    const { onSuccess } = this.props
    const currUrl = window.location.href

    try {
      this.setState({ submitting: true })
      await Ajax().User.createSupportRequest({ ...this.getRequest(), currUrl })
      onSuccess()
    } catch (error) {
      this.setState({ submitting: false })
      reportError('Error submitting support request', error)
    }
  }
})

export default SupportRequestModal
