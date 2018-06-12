import _ from 'lodash/fp'
import { Component, Fragment, createRef } from 'react'
import { createPortal } from 'react-dom'
import Autosuggest from 'react-autosuggest'
import { div, h } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import { icon } from 'src/components/icons'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const styles = {
  suggestionsContainer: {
    position: 'fixed',
    maxHeight: 36 * 8 + 2, overflowY: 'auto',
    backgroundColor: 'white',
    border: `1px solid ${Style.colors.border}`
  },
  suggestion: {
    display: 'block', lineHeight: '2.25rem',
    paddingLeft: '1rem', paddingRight: '1rem',
    cursor: 'pointer'
  }
}

export const textInput = function(props) {
  return h(Interactive, _.mergeAll([
    {
      as: 'input',
      style: {
        width: '100%',
        paddingLeft: '1rem', paddingRight: '1rem',
        fontWeight: 300, fontSize: 14,
        backgroundColor: props.disabled ? '#f3f3f3' : undefined
      }
    },
    Style.elements.input,
    props
  ]))
}


export const numberInput = props => {
  return h(Interactive, _.mergeAll([{
    as: 'input',
    type: 'number',
    style: {
      width: '100%',
      paddingLeft: '1rem',
      paddingRight: '0.25rem',
      fontWeight: 300,
      fontSize: 14
    }
  }, Style.elements.input, props]))
}


export class IntegerInput extends Component {
  constructor(props) {
    super(props)
    this.state = { textValue: undefined, lastValue: undefined }
  }

  static getDerivedStateFromProps({ value }, { lastValue }) {
    if (value !== lastValue) {
      return { textValue: value.toString(), lastValue: value }
    }
    return null
  }

  render() {
    const { textValue } = this.state
    const { onChange, min = -Infinity, max = Infinity, ...props } = this.props
    return numberInput({
      ...props, min, max, value: textValue,
      onChange: e => this.setState({ textValue: e.target.value }),
      onBlur: () => {
        const newValue = _.clamp(min, max, _.floor(textValue * 1))
        this.setState({ lastValue: undefined })
        onChange(newValue)
      }
    })
  }
}


/**
 * @param props.inputProps {object}
 * @param props.name {string} - user-facing name for input
 * @param props.errors {string[]}
 */
export const validatedInput = props => {
  const { inputProps, name, errors } = props

  return h(Fragment, [
    div({
      style: { position: 'relative', display: 'flex', alignItems: 'center' }
    }, [
      textInput(_.merge({
        style: errors ? {
          paddingRight: '2.25rem', // leave room for error icon
          backgroundColor: Style.colors.errorFaded,
          border: `1px solid ${Style.colors.error}`
        } : undefined
      }, inputProps)),
      errors && icon('exclamation-circle', {
        size: 24,
        style: {
          position: 'absolute', color: Style.colors.error,
          right: '.5rem'
        }
      })
    ]),
    errors && div({
      style: {
        color: Style.colors.error, textTransform: 'uppercase', fontSize: 10, fontWeight: 500,
        marginLeft: '1rem'
      }
    },
    _.map(fail => div({ style: { marginTop: '0.5rem' } }, `${name} ${fail}`), errors)
    )
  ])
}

class AutocompleteSuggestions extends Component {
  constructor(props) {
    super(props)
    this.el = document.createElement('div')
    this.state = { top: undefined, left: undefined, width: undefined }
  }

  componentDidMount() {
    document.getElementById('modal-root').appendChild(this.el)
    this.reposition()
    this.interval = setInterval(() => this.reposition(), 200)
  }

  componentWillUnmount() {
    document.getElementById('modal-root').removeChild(this.el)
    clearInterval(this.interval)
  }

  reposition() {
    const { containerRef } = this.props
    const { top, left, width } = containerRef.current.getBoundingClientRect()
    if (!_.isEqual({ top, left, width }, _.pick(['top', 'left', 'width'], this.state))) {
      this.setState({ top, left, width })
    }
  }

  render() {
    const { containerProps, children } = this.props
    const { top, left, width } = this.state
    return createPortal(
      div({
        ...containerProps,
        style: { ...styles.suggestionsContainer, top, left, width }
      }, [children]),
      this.el
    )
  }
}

export class AutocompleteTextInput extends Component {
  constructor(props) {
    super(props)
    this.state = { show: false }
    this.containerRef = createRef()
    this.id = _.uniqueId()
  }

  render() {
    const { value, onChange, suggestions, ...props } = this.props
    const { show } = this.state
    return h(Autosuggest, {
      id: this.id,
      inputProps: { value, onChange: e => onChange(e.target.value) },
      suggestions: show ? (value ? _.filter(Utils.textMatch(value), suggestions) : suggestions) : [],
      onSuggestionsFetchRequested: () => this.setState({ show: true }),
      onSuggestionsClearRequested: () => this.setState({ show: false }),
      onSuggestionSelected: (e, { suggestionValue }) => onChange(suggestionValue),
      getSuggestionValue: _.identity,
      shouldRenderSuggestions: () => true,
      focusInputOnSuggestionClick: false,
      renderSuggestionsContainer: ({ containerProps, children }) => {
        return div({ ref: this.containerRef }, [
          children && h(AutocompleteSuggestions, { containerProps, children, containerRef: this.containerRef })
        ])
      },
      renderSuggestion: v => v,
      renderInputComponent: inputProps => {
        return textInput({ ...props, ...inputProps, type: 'search' })
      },
      theme: {
        container: { width: '100%' },
        suggestionsList: { margin: 0, padding: 0 },
        suggestion: styles.suggestion,
        suggestionHighlighted: { backgroundColor: Style.colors.highlightFaded }
      }
    })
  }
}
