import Downshift from 'downshift'
import _ from 'lodash/fp'
import { Fragment, useRef, useState } from 'react'
import { div, h, input, textarea } from 'react-hyperscript-helpers'
import TextAreaAutosize from 'react-textarea-autosize'
import { ButtonPrimary } from 'src/components/common'
import { icon } from 'src/components/icons'
import { PopupPortal, useDynamicPosition } from 'src/components/popup-utils'
import colors from 'src/libs/colors'
import * as Utils from 'src/libs/utils'


const styles = {
  input: {
    height: '2.25rem',
    border: `1px solid ${colors.dark(0.55)}`, borderRadius: 4
  },
  suggestionsContainer: {
    position: 'fixed', top: 0, left: 0,
    maxHeight: 36 * 8 + 2, overflowY: 'auto',
    backgroundColor: 'white',
    border: `1px solid ${colors.light()}`
  },
  suggestion: isSelected => ({
    display: 'block', lineHeight: '2.25rem',
    paddingLeft: '1rem', paddingRight: '1rem',
    cursor: 'pointer',
    backgroundColor: isSelected ? colors.light(0.4) : undefined
  }),
  textarea: {
    width: '100%', resize: 'none',
    border: `1px solid ${colors.dark(0.55)}`, borderRadius: 4,
    fontSize: 14, fontWeight: 400,
    padding: '0.5rem 1rem',
    cursor: 'text'
  },
  validationError: {
    color: colors.danger(),
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    marginLeft: '1rem', marginTop: '0.5rem'
  }
}

export const withDebouncedChange = WrappedComponent => {
  const Wrapper = ({ onChange, value, ...props }) => {
    const [internalValue, setInternalValue] = useState()
    const getInternalValue = Utils.useGetter(internalValue)
    const getOnChange = Utils.useGetter(onChange)
    const updateParent = Utils.useInstance(() => _.debounce(250, () => {
      getOnChange()(getInternalValue())
      setInternalValue(undefined)
    }))
    return h(WrappedComponent, {
      value: internalValue !== undefined ? internalValue : value,
      onChange: v => {
        setInternalValue(v)
        updateParent()
      },
      ...props
    })
  }
  return Wrapper
}

export const TextInput = Utils.forwardRefWithName('TextInput', ({ onChange, nativeOnChange = false, ...props }, ref) => {
  Utils.useConsoleAssert(props.id || props['aria-label'], 'In order to be accessible, TextInput needs a label')

  return input({
    ..._.merge({
      className: 'focus-style',
      onChange: onChange ? e => onChange(nativeOnChange ? e : e.target.value) : undefined,
      style: {
        ...styles.input,
        width: '100%',
        paddingLeft: '1rem', paddingRight: '1rem',
        fontWeight: 400, fontSize: 14,
        backgroundColor: props.disabled ? colors.light() : undefined
      }
    }, props),
    // the ref does not get added to the props correctly when inside of _.merge
    ref
  })
})

export const ConfirmedSearchInput = ({ defaultValue = '', onChange = _.noop, ...props }) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const inputEl = useRef()

  Utils.useOnMount(() => {
    inputEl.current.addEventListener('search', e => {
      setInternalValue(e.target.value)
      onChange(e.target.value)
    })
  })

  return div({ style: { display: 'inline-flex', width: '100%' } }, [
    h(TextInput, {
      ..._.merge({
        type: 'search',
        spellCheck: false,
        style: { WebkitAppearance: 'none', borderColor: colors.dark(0.55), borderRadius: '4px 0 0 4px' },
        value: internalValue,
        onChange: setInternalValue,
        onKeyDown: e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onChange(internalValue)
          } else if (e.key === 'Escape' && internalValue !== '') {
            e.preventDefault()
            e.stopPropagation()
            setInternalValue('')
            onChange('')
          }
        }
      }, props),
      // the ref does not get added to the props correctly when inside of _.merge
      ref: inputEl
    }),
    h(ButtonPrimary, {
      'aria-label': 'Search',
      style: { borderRadius: '0 4px 4px 0', borderLeft: 'none' },
      onClick: () => onChange(internalValue)
    }, [icon('search', { size: 18 })])
  ])
}

export const SearchInput = ({ value, onChange, ...props }) => {
  return h(TextInput, _.merge({
    type: 'search',
    spellCheck: false,
    style: { WebkitAppearance: 'none', borderColor: colors.dark(0.55) },
    value, onChange,
    onKeyDown: e => {
      if (e.key === 'Escape' && value !== '') {
        e.stopPropagation()
        onChange('')
      }
    }
  }, props))
}

export const DelayedSearchInput = withDebouncedChange(SearchInput)

export const NumberInput = ({ onChange, onBlur, min = -Infinity, max = Infinity, onlyInteger = false, isClearable = true, value, ...props }) => {
  Utils.useConsoleAssert(props.id || props['aria-label'], 'In order to be accessible, NumberInput needs a label')
  const [internalValue, setInternalValue] = useState()

  return input(_.merge({
    type: 'number',
    className: 'focus-style',
    min, max,
    value: internalValue !== undefined ? internalValue : _.toString(value), // eslint-disable-line lodash-fp/preferred-alias
    onChange: ({ target: { value: newValue } }) => {
      setInternalValue(newValue)
      // note: floor and clamp implicitly convert the value to a number
      onChange(newValue === '' && isClearable ? null : _.clamp(min, max, onlyInteger ? _.floor(newValue) : newValue))
    },
    onBlur: (...args) => {
      onBlur && onBlur(...args)
      setInternalValue(undefined)
    },
    style: {
      ...styles.input,
      width: '100%',
      paddingLeft: '1rem',
      paddingRight: '0.25rem',
      fontWeight: 400,
      fontSize: 14,
      backgroundColor: props.disabled ? colors.dark(.25) : undefined
    }
  }, props))
}

/**
 * @param {object} props.inputProps
 * @param {object} [props.error] - error message content
 */
export const ValidatedInput = ({ inputProps, width, error }) => {
  return h(Fragment, [
    div({
      style: { position: 'relative', display: 'flex', alignItems: 'center', width }
    }, [
      h(TextInput, _.merge({
        style: error ? {
          paddingRight: '2.25rem', // leave room for error icon
          border: `1px solid ${colors.danger()}`
        } : undefined
      }, inputProps)),
      error && icon('error-standard', {
        size: 24,
        style: {
          position: 'absolute', color: colors.danger(),
          right: '.5rem'
        }
      })
    ]),
    error && div({ style: styles.validationError }, [error])
  ])
}

const AutocompleteSuggestions = ({ target: targetId, containerProps, children }) => {
  const [target] = useDynamicPosition([{ id: targetId }])
  return h(PopupPortal, [
    div({
      ...containerProps,
      style: {
        transform: `translate(${target.left}px, ${target.bottom}px)`, width: target.width,
        visibility: !target.width ? 'hidden' : undefined,
        ...styles.suggestionsContainer
      }
    }, [children])
  ])
}

const withAutocomplete = WrappedComponent => ({ value, onChange, suggestions: rawSuggestions, style, id, renderSuggestion = _.identity, openOnFocus = true, ...props }) => {
  const suggestions = _.filter(Utils.textMatch(value), rawSuggestions)

  return h(Downshift, {
    selectedItem: value,
    onInputValueChange: newValue => {
      if (newValue !== value) {
        onChange(newValue)
      }
    },
    inputId: id
  }, [
    ({ getInputProps, getMenuProps, getItemProps, isOpen, openMenu, toggleMenu, highlightedIndex }) => {
      return div({ style: { width: '100%', display: 'inline-flex' } }, [
        h(WrappedComponent, getInputProps({
          style,
          type: 'search',
          onFocus: openOnFocus ? openMenu : undefined,
          onKeyDown: e => {
            if (e.key === 'Escape') {
              (value || isOpen) && e.stopPropagation() // prevent e.g. closing a modal
              if (!value || isOpen) { // don't clear if blank (prevent e.g. undefined -> '') or if menu is shown
                e.nativeEvent.preventDownshiftDefault = true
                e.preventDefault()
              }
              toggleMenu()
            } else if (_.includes(e.key, ['ArrowUp', 'ArrowDown']) && !suggestions.length) {
              e.nativeEvent.preventDownshiftDefault = true
            }
          },
          nativeOnChange: true,
          ...props
        })),
        isOpen && !!suggestions.length && h(AutocompleteSuggestions, {
          target: getInputProps().id,
          containerProps: getMenuProps()
        }, _.map(([index, item]) => {
          return div(getItemProps({
            item, key: item,
            style: styles.suggestion(highlightedIndex === index)
          }), [renderSuggestion(item)])
        }, Utils.toIndexPairs(suggestions)))
      ])
    }
  ])
}

export const AutocompleteTextInput = withAutocomplete(TextInput)

export const TextArea = ({ onChange, autosize = false, nativeOnChange = false, ...props }) => {
  Utils.useConsoleAssert(props.id || props['aria-label'], 'In order to be accessible, TextArea needs a label')

  return h(autosize ? TextAreaAutosize : 'textarea', _.merge({
    className: 'focus-style',
    style: styles.textarea,
    onChange: onChange ? (e => onChange(nativeOnChange ? e : e.target.value)) : undefined
  }, props))
}

export const DelayedAutocompleteTextArea = withDebouncedChange(withAutocomplete(TextArea))

export const PasteOnlyInput = ({ onPaste, ...props }) => {
  Utils.useConsoleAssert(props.id || props['aria-label'], 'In order to be accessible, PasteOnlyInput needs a label')

  return textarea(_.merge({
    className: 'focus-style',
    style: { ...styles.textarea, resize: 'vertical' },
    onPaste: e => {
      onPaste(e.clipboardData.getData('Text'))
    }
  }, props))
}
