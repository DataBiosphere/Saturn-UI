import _ from 'lodash/fp'
import { Component } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { buttonPrimary, linkButton, search, Select, spinnerOverlay } from 'src/components/common'
import { centeredSpinner, icon } from 'src/components/icons'
import { AutocompleteTextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import TooltipTrigger from 'src/components/TooltipTrigger'
import { Groups, Workspaces } from 'src/libs/ajax'
import { getBasicProfile } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


const styles = {
  searchArea: {
    margin: '0 -1.25rem',
    padding: '0 1.25rem 2rem',
    borderBottom: Style.standardLine
  },
  currentCollaboratorsArea: {
    margin: '0 -1.25rem',
    padding: '0.75rem 1.25rem 6rem',
    maxHeight: 550,
    overflowY: 'auto',
    borderBottom: Style.standardLine
  },
  pending: {
    textTransform: 'uppercase', fontWeight: 500,
    color: colors.orange[0]
  },
  roleSelect: {
    width: 200,
    display: 'inline-flex',
    marginTop: '0.25rem'
  },
  suggestionContainer: {
    display: 'flex', alignItems: 'center',
    padding: '0.5rem 1rem',
    borderBottom: `1px solid ${colors.gray[4]}`
  },
  suggestion: {
    flex: 1
  }
}


export default class ShareWorkspaceModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      shareSuggestions: undefined,
      originalAcl: [],
      acl: [],
      loaded: false,
      searchValue: ''
    }
  }

  render() {
    const { onDismiss } = this.props
    const { acl, shareSuggestions, groups, loaded, searchValue, working, updateError } = this.state
    const searchValueInvalid = !!validate({ searchValue }, { searchValue: { email: true } })

    const suggestions = _.flow(
      _.map('groupEmail'),
      _.concat(shareSuggestions),
      _.concat(searchValue.trim() ? [searchValue.trim()] : []),
      _.uniq
    )(groups)

    return h(Modal, {
      title: 'Share Workspace',
      width: 550,
      okButton: buttonPrimary({ onClick: () => this.save() }, ['Save']),
      onDismiss
    }, [
      div({ style: styles.searchArea }, [
        search({
          inputElement: AutocompleteTextInput,
          inputProps: {
            placeholder: 'Add people or groups',
            value: searchValue,
            renderSuggestion: suggestion => div({ style: styles.suggestionContainer }, [
              div({ style: styles.suggestion }, [
                suggestion === searchValue && searchValueInvalid && h(TooltipTrigger, {
                  content: 'Not a valid email address'
                }, [
                  icon('warning-standard', { style: { color: colors.red[0], marginRight: '0.5rem' } })
                ]),
                suggestion
              ]),
              linkButton({}, [icon('plus-circle', { size: 24 })])
            ]),
            onChange: (v, fromSuggestionClick) => {
              if (fromSuggestionClick) {
                if (v !== searchValue || !searchValueInvalid) {
                  this.addAcl(v)
                }
              } else {
                this.setState({ searchValue: v })
              }
            },
            onKeyDown: e => {
              // 13 = Enter, 27 = Escape
              if (e.which === 27) {
                e.stopPropagation()
              } else if (e.which === 13 && !searchValueInvalid) {
                this.addAcl(searchValue)
              }
            },
            suggestions: _.difference(suggestions, _.map('email', acl)),
            style: { fontSize: 16, padding: '0 1rem 0 0', height: 'unset', border: 'none' },
            focus: { border: 'none' },
            theme: { suggestion: { padding: 0 } }
          }
        })
      ]),
      div({ style: styles.currentCollaboratorsArea }, [
        div({ style: Style.elements.sectionHeader }, ['Current Collaborators']),
        ...acl.map(this.renderCollaborator),
        !loaded && centeredSpinner()
      ]),
      updateError && div({ style: { marginTop: '1rem' } }, [
        div({}, ['An error occurred:']),
        updateError
      ]),
      working && spinnerOverlay
    ])
  }

  addAcl(email) {
    const { acl } = this.state
    this.setState({ acl: _.concat(acl, [{ email, accessLevel: 'READER', pending: false }]), searchValue: '' })
  }

  renderCollaborator = ({ email, accessLevel, pending }, index) => {
    const isPO = accessLevel === 'PROJECT_OWNER'
    const isMe = email === getBasicProfile().getEmail()
    const { acl } = this.state

    return div({
      style: { display: 'flex', padding: '0.5rem', borderTop: index && `1px solid ${colors.gray[4]}` }
    }, [
      div({
        style: { flex: 1 }
      }, [
        div({}, [email]),
        pending && div({ style: styles.pending }, ['Pending']),
        isPO ?
          h(Select, {
            wrapperStyle: styles.roleSelect,
            disabled: true,
            value: 'Project Owner',
            options: [{ label: 'Project Owner', value: 'Project Owner' }]
          }) :
          h(Select, {
            wrapperStyle: styles.roleSelect,
            searchable: false, clearable: false,
            disabled: isMe,
            value: accessLevel,
            onChange: ({ value }) => this.setState({ acl: _.set([index, 'accessLevel'], value, acl) }),
            options: _.map(level => ({ label: level, value: level.toUpperCase() }), ['Reader', 'Writer', 'Owner'])
          })
      ]),
      !isPO && !isMe && linkButton({
        onClick: () => this.setState({ acl: _.remove({ email }, acl) })
      }, [icon('minus-circle', { size: 24 })])
    ])
  }

  async componentDidMount() {
    const { namespace, name, onDismiss } = this.props

    try {
      const [{ acl }, shareSuggestions, groups] = await Promise.all([
        Workspaces.workspace(namespace, name).getAcl(),
        Workspaces.getShareLog(),
        Groups.list()
      ])

      const fixedAcl = _.flow(
        _.toPairs,
        _.map(([email, { pending, accessLevel }]) => ({ email, pending, accessLevel })),
        _.sortBy(x => -Utils.workspaceAccessLevels.indexOf(x.accessLevel))
      )(acl)

      this.setState({
        acl: fixedAcl,
        originalAcl: fixedAcl,
        groups,
        shareSuggestions,
        loaded: true
      })
    } catch (error) {
      onDismiss()
      reportError('Error looking up collaborators', error)
    }
  }

  async save() {
    const { namespace, name, onDismiss } = this.props
    const { acl, originalAcl } = this.state

    const aclEmails = _.map('email', acl)
    const needsDelete = _.remove(entry => aclEmails.includes(entry.email), originalAcl)

    const aclUpdates = _.concat(
      _.flow(
        _.remove({ accessLevel: 'PROJECT_OWNER' }),
        _.map(({ email, accessLevel }) => ({
          email, accessLevel,
          canShare: Utils.isOwner(accessLevel),
          canCompute: Utils.canWrite(accessLevel)
        }))
      )(acl),
      _.map(({ email }) => ({ email, accessLevel: 'NO ACCESS' }), needsDelete)
    )

    try {
      this.setState({ working: true })
      await Workspaces.workspace(namespace, name).updateAcl(aclUpdates)
      onDismiss()
    } catch (error) {
      this.setState({ updateError: await error.text(), working: false })
    }
  }
}
