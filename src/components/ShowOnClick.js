import _ from 'lodash'
import { div } from 'react-hyperscript-helpers'
import { Component } from 'src/libs/wrapped-components'


/**
 * @param [containerProps]
 * @param button
 * @param [bgProps]
 * @param [closeOnClick=true]
 * @param [closeOnEsc=true]
 * @param children
 */
export default class ShowOnClick extends Component {
  setVisibility = visible => {
    this.setState({ visible })
  }

  listenForEscape = e => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', this.listenForEscape)
      this.setState({ visible: false })
    }
  }

  render() {
    const { visible } = this.state
    const { containerProps, button, disabled, bgProps, closeOnClick = true, closeOnEsc = true, children } = this.props

    return div(_.merge({
      style: visible ? { position: 'relative' } : undefined,
      onClick: disabled ? undefined : e => {
        this.setState({ visible: true })
        e.preventDefault()
        if (closeOnEsc) {
          window.addEventListener('keydown', this.listenForEscape)
        }
      }
    }, containerProps),
    [
      button,
      !visible ? null :
        div(_.merge({
          style: {
            position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, cursor: 'pointer'
          },
          onClick: closeOnClick ? e => {
            this.setState({ visible: false })
            e.preventDefault()
            e.stopPropagation()
          } : undefined
        }, bgProps)),
      visible ? children : null
    ])
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.listenForEscape)
  }
}
