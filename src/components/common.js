import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h, input } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import { StatefulToolTip } from 'react-portal-tooltip'
import RSelect from 'react-select'
import { centeredSpinner, icon } from 'src/components/icons'
import * as Style from 'src/libs/style'
import 'react-select/dist/react-select.css'


export const link = function(props, children) {
  return h(Interactive,
    _.merge({
      as: 'a',
      style: {
        textDecoration: 'none',
        color: props.disabled ? Style.colors.disabled : Style.colors.secondary,
        cursor: props.disabled ? 'not-allowed' : 'pointer'
      },
      hover: props.disabled ? undefined : { color: Style.colors.primary }
    }, props),
    children)
}

export const buttonPrimary = function(props, children) {
  return h(Interactive,
    _.merge({
      as: 'button',
      style: {
        ...Style.elements.button,
        border: 'none', borderRadius: 5, color: 'white',
        height: '2.25rem', padding: '0 1.5rem',
        backgroundColor: props.disabled ? Style.colors.disabled : Style.colors.secondary,
        cursor: props.disabled ? 'not-allowed' : 'pointer'
      },
      hover: props.disabled ? undefined : { backgroundColor: Style.colors.primary }
    }, props),
    children)
}

export const buttonSecondary = (props, children) => {
  const { disabled } = props
  return h(Interactive,
    _.merge({
      as: 'button',
      style: {
        ...Style.elements.button,
        border: 'none', height: '2.25rem', padding: 0, backgroundColor: 'transparent',
        color: disabled ? Style.colors.disabled : Style.colors.text,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }
    }, props),
    children
  )
}

export const search = function({ wrapperProps, inputProps }) {
  return div(
    _.merge({ style: { borderBottom: '1px solid black', padding: '0.5rem 0', display: 'flex' } },
      wrapperProps),
    [
      icon('search'),
      input(_.merge({
        style: {
          border: 'none', outline: 'none',
          flexGrow: 1,
          verticalAlign: 'bottom', marginLeft: '1rem'
        }
      }, inputProps))
    ])
}

export const contextBar = function(props, children) {
  return div(_.merge({
    style: {
      display: 'flex', alignItems: 'center', backgroundColor: Style.colors.primary,
      color: Style.colors.textAlt, fontWeight: 500,
      height: '3.75rem', padding: '0 1rem'
    }
  }, props),
  children)
}

export const contextMenu = function(items) {
  return div({
    style: {
      backgroundColor: 'white', minWidth: 125, border: '1px solid #ccc',
      boxShadow: Style.standardShadow
    }
  },
  _.map(([props, contents]) => h(Interactive,
    _.merge({
      as: 'div',
      style: { fontSize: 12, padding: '0.5rem 1.5rem' },
      hover: { backgroundColor: Style.colors.highlight, fontWeight: 500 }
    }, props),
    contents), items)
  )
}

export const Checkbox = ({ checked, onChange, disabled, ...props }) => {
  return h(Interactive, {
    as: 'span',
    role: 'checkbox',
    'aria-checked': checked,
    onClick: () => onChange && !disabled && onChange(!checked),
    style: {
      display: 'inline-flex',
      verticalAlign: 'middle',
      color: disabled ? Style.colors.disabled : Style.colors.secondary
    },
    hover: disabled ? undefined : { color: Style.colors.primary },
    active: disabled ? undefined : { backgroundColor: Style.colors.highlightFaded },
    disabled,
    ...props
  }, [
    icon(checked ? 'checkSquare' : 'square', { size: 16 })
  ])
}

export const LabeledCheckbox = ({ checked, onChange, disabled, children, ...props }) => {
  return h(Fragment, [
    h(Checkbox, { checked, onChange, disabled, ...props }),
    h(Interactive, {
      as: 'span',
      style: { verticalAlign: 'middle' },
      onClick: () => onChange && !disabled && onChange(!checked)
    }, [children])
  ])
}

export const tooltip = ({ component, position = 'bottom', arrow = 'right', align = 'right', text, ...props }) =>
  h(StatefulToolTip, {
    parent: component,
    position, arrow, align,
    group: _.uniqueId(), tooltipTimeout: 0,
    style: { style: { whiteSpace: 'nowrap', transition: 'none' }, arrowStyle: {} },
    ...props
  }, text)

export const pageColumn = function(title, flex, contents) {
  return div(
    { style: { flex, overflow: 'hidden', margin: '3rem' } },
    [
      div({ style: { ...Style.elements.sectionHeader, fontWeight: 500, marginBottom: '1rem' } },
        title
      ),
      contents
    ])
}

export const spinnerOverlay = div(
  {
    style: {
      position: 'absolute',
      display: 'flex', alignItems: 'center',
      top: 0, right: 0, bottom: 0, left: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.1)'
    }
  }, [
    centeredSpinner({
      size: 64,
      style: { backgroundColor: 'rgba(255, 255, 255, 0.85)', padding: '1rem', borderRadius: '0.5rem' }
    })
  ]
)

export const Select = RSelect
