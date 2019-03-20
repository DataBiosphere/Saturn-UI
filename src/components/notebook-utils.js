import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { div, h } from 'react-hyperscript-helpers'
import { buttonPrimary, Select, spinnerOverlay } from 'src/components/common'
import { centeredSpinner } from 'src/components/icons'
import { validatedInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { ajaxCaller } from 'src/libs/ajax'
import { reportError } from 'src/libs/error'
import { RequiredFormLabel } from 'src/libs/forms'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'
import validate from 'validate.js'


export const notebookNameValidator = existing => ({
  presence: { allowEmpty: false },
  format: {
    pattern: /^[^#[\]*?:;@$%+=\\,/]*$/,
    message: 'can\'t contain these characters: \r \r  @ # $ % * + = ? , [ ] : ; / \\ '
  },
  exclusion: {
    within: existing,
    message: 'already exists'
  }
})

export const notebookNameInput = props => validatedInput(_.merge({
  inputProps: {
    autoFocus: true,
    placeholder: 'Enter a name'
  }
}, props))


const baseNotebook = {
  'cells': [
    { 'cell_type': 'code', 'execution_count': null, 'metadata': {}, 'outputs': [], 'source': [] }
  ], 'nbformat': 4, 'nbformat_minor': 2
}

const notebookData = {
  python2: _.merge({
    'metadata': {
      'kernelspec': { 'display_name': 'Python 2', 'language': 'python', 'name': 'python2' }
    }
  }, baseNotebook),
  python3: _.merge({
    'metadata': {
      'kernelspec': { 'display_name': 'Python 3', 'language': 'python', 'name': 'python3' }
    }
  }, baseNotebook),
  r: _.merge({
    'metadata': {
      'kernelspec': { 'display_name': 'R', 'language': 'R', 'name': 'ir' },
      'language_info': {
        'codemirror_mode': 'r', 'file_extension': '.r', 'mimetype': 'text/x-r-source', 'name': 'R',
        'pygments_lexer': 'r', 'version': '3.3.3'
      }
    }
  }, baseNotebook)
}


export const NotebookCreator = ajaxCaller(class NotebookCreator extends Component {
  static propTypes = {
    reloadList: PropTypes.func.isRequired,
    onDismiss: PropTypes.func.isRequired,
    namespace: PropTypes.string.isRequired,
    bucketName: PropTypes.string.isRequired,
    existingNames: PropTypes.arrayOf(PropTypes.string).isRequired
  }

  constructor(props) {
    super(props)
    this.state = { notebookName: '' }
  }

  render() {
    const { notebookName, notebookKernel, creating, nameTouched } = this.state
    const { reloadList, onDismiss, namespace, bucketName, existingNames, ajax: { Buckets } } = this.props

    const errors = validate(
      { notebookName, notebookKernel },
      {
        notebookName: notebookNameValidator(existingNames),
        notebookKernel: { presence: { allowEmpty: false } }
      },
      { prettify: v => ({ notebookName: 'Name', notebookKernel: 'Language' }[v] || validate.prettify(v)) }
    )

    return h(Modal, {
      onDismiss,
      title: 'Create New Notebook',
      okButton: buttonPrimary({
        disabled: creating || errors,
        tooltip: Utils.summarizeErrors(errors),
        onClick: async () => {
          this.setState({ creating: true })
          try {
            await Buckets.notebook(namespace, bucketName, notebookName).create(notebookData[notebookKernel])
            reloadList()
            onDismiss()
          } catch (error) {
            await reportError('Error creating notebook', error)
            onDismiss()
          }
        }
      }, 'Create Notebook')
    }, [
      h(RequiredFormLabel, ['Name']),
      notebookNameInput({
        error: Utils.summarizeErrors(nameTouched && errors && errors.notebookName),
        inputProps: {
          value: notebookName,
          onChange: e => this.setState({ notebookName: e.target.value, nameTouched: true })
        }
      }),
      h(RequiredFormLabel, ['Language']),
      h(Select, {
        isSearchable: false,
        placeholder: 'Select a language',
        getOptionLabel: ({ value }) => _.startCase(value),
        value: notebookKernel,
        onChange: ({ value: notebookKernel }) => this.setState({ notebookKernel }),
        options: ['python2', 'python3', 'r']
      }),
      creating && spinnerOverlay
    ])
  }
})

export const NotebookDuplicator = ajaxCaller(class NotebookDuplicator extends Component {
  static propTypes = {
    destroyOld: PropTypes.bool,
    printName: PropTypes.string.isRequired,
    namespace: PropTypes.string.isRequired,
    bucketName: PropTypes.string.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    existingNames: PropTypes.arrayOf(PropTypes.string).isRequired
  }

  static defaultProps = {
    destroyOld: false
  }

  constructor(props) {
    super(props)
    this.state = { newName: '' }
  }

  render() {
    const { destroyOld, printName, namespace, bucketName, onDismiss, onSuccess, existingNames, ajax: { Buckets } } = this.props
    const { newName, processing, nameTouched } = this.state

    const errors = validate(
      { newName },
      { newName: notebookNameValidator(existingNames) },
      { prettify: v => ({ newName: 'Name' }[v] || validate.prettify(v)) }
    )

    return h(Modal, {
      onDismiss,
      title: `${destroyOld ? 'Rename' : 'Duplicate'} "${printName}"`,
      okButton: buttonPrimary({
        disabled: errors || processing,
        tooltip: Utils.summarizeErrors(errors),
        onClick: async () => {
          try {
            this.setState({ processing: true })
            await (destroyOld ?
              Buckets.notebook(namespace, bucketName, printName).rename(newName) :
              Buckets.notebook(namespace, bucketName, printName).copy(newName, bucketName))
            onSuccess()
          } catch (error) {
            reportError(`Error ${destroyOld ? 'renaming' : 'copying'} notebook`, error)
          }
        }
      }, `${destroyOld ? 'Rename' : 'Duplicate'} Notebook`)
    },
    Utils.cond(
      [processing, () => [centeredSpinner()]],
      () => [
        h(RequiredFormLabel, ['New Name']),
        notebookNameInput({
          error: Utils.summarizeErrors(nameTouched && errors && errors.newName),
          inputProps: {
            value: newName,
            onChange: e => this.setState({ newName: e.target.value, nameTouched: true })
          }
        })
      ]
    ))
  }
})

export const NotebookDeleter = ajaxCaller(class NotebookDeleter extends Component {
  static propTypes = {
    printName: PropTypes.string.isRequired,
    namespace: PropTypes.string.isRequired,
    bucketName: PropTypes.string.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
  }

  render() {
    const { printName, namespace, bucketName, onDismiss, onSuccess, ajax: { Buckets } } = this.props
    const { processing } = this.state

    return h(Modal, {
      onDismiss,
      title: `Delete "${printName}"`,
      okButton: buttonPrimary({
        disabled: processing,
        onClick: () => {
          this.setState({ processing: true })
          Buckets.notebook(namespace, bucketName, printName).delete().then(
            onSuccess,
            error => reportError('Error deleting notebook', error)
          )
        }
      }, 'Delete Notebook')
    },
    Utils.cond(
      [processing, () => [centeredSpinner()]],
      () => [
        div({ style: { fontSize: '1rem', flexGrow: 1 } },
          [
            `Are you sure you want to delete "${printName}"?`,
            div({ style: { fontWeight: 500, lineHeight: '2rem' } }, 'This cannot be undone.')
          ]
        )
      ]
    ))
  }
})
