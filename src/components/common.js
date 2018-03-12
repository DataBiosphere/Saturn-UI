import mixinDeep from 'mixin-deep'
import { div, h, input, span } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import _ from 'underscore'
import { icon } from 'src/icons'
import * as Style from 'src/style'
import * as Utils from 'src/utils'


const link = function(props, children) {
  return h(Interactive,
    mixinDeep({
      as: 'a',
      style: {
        textDecoration: 'none',
        color: props.disabled ? Style.colors.disabled : Style.colors.secondary,
        cursor: props.disabled ? 'not-allowed' : 'pointer'
      },
      hover: props.disabled ? null : { color: Style.colors.primary }
    }, props),
    children)
}

const card = function(props, children) {
  return div(mixinDeep({
      style: {
        borderRadius: 5, padding: '1rem', wordWrap: 'break-word',
        backgroundColor: 'white',
        boxShadow: '0 0 2px 0 rgba(0,0,0,0.12), 0 3px 2px 0 rgba(0,0,0,0.12)'
      }
    }, props),
    children)
}

const buttonPrimary = function(props, children) {
  return div(mixinDeep({
      style: _.extend(Style.elements.button,
        {
          padding: '2rem 0.5rem', borderRadius: 5,
          color: 'white',
          backgroundColor: props.disabled ? Style.colors.disabled : Style.colors.secondary,
          cursor: props.disabled ? 'not-allowed' : 'pointer'
        }),
      hoverStyle: Style.colors.disabled ? null : { backgroundColor: Style.colors.primary }
    }, props),
    children)
}

const search = function({ wrapperProps = {}, inputProps = {} }) {
  return div(
    mixinDeep({ style: { borderBottom: '1px solid black', padding: '0.5rem 0', display: 'flex' } },
      wrapperProps),
    [
      icon('search'),
      input(mixinDeep({
        style: {
          border: 'none', outline: 'none',
          flexGrow: 1,
          verticalAlign: 'bottom', marginLeft: '1rem'
        }
      }, inputProps))
    ])
}

const topBar = function(child) {
  return div(
    {
      style: {
        backgroundColor: 'white', height: '3rem', padding: '1rem',
        display: 'flex', alignItems: 'center'
      }
    },
    [
      icon('bars',
        { size: 36, style: { marginRight: '2rem', color: Style.colors.accent } }),
      span({ style: Style.elements.pageTitle },
        'Saturn'),
      child,
      div({ style: { flexGrow: 1 } }),
      link({
        onClick: Utils.getAuthInstance().signOut
      }, 'Sign out')
    ]
  )
}

const contextBar = function(props = {}, children = []) {
  return div(mixinDeep({
      style: {
        display: 'flex', alignItems: 'center', backgroundColor: Style.colors.primary,
        color: Style.colors.textAlt, fontWeight: 500,
        height: '1.5rem', padding: '1rem'
      }
    }, props),
    children)
}

export { card, link, search, buttonPrimary, topBar, contextBar }
