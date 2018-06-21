import _ from 'lodash/fp'
import * as ReactDOM from 'react-dom'
import { div, h } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import { buttonPrimary, buttonSecondary } from 'src/components/common'
import { icon } from 'src/components/icons'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import { Component } from 'src/libs/wrapped-components'


const modalRoot = document.getElementById('modal-root')

/**
 * @param onDismiss
 * @param title
 * @param children
 * @param showCancel=true
 * @param okButton
 */
export default class Modal extends Component {
  constructor(props) {
    super(props)
    this.el = document.createElement('div')
  }

  listenForEscape = e => {
    if (e.key === 'Escape') {
      this.props.onDismiss()
    }
  }

  componentDidMount() {
    const root = document.getElementById('root')
    root.classList.add('overlayOpen')
    if (root.scrollHeight > window.innerHeight) {
      root.classList.add('overHeight')
    }

    window.addEventListener('keydown', this.listenForEscape)
    modalRoot.appendChild(this.el)
  }

  render() {
    const { onDismiss, title, titleExtras = [], children, width = 450, showCancel = true, showX = false, okButton } = this.props

    const component = div({
      style: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: '2rem 1rem',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, overflowY: 'auto'
      }
    }, [
      div({
        style: {
          width, borderRadius: 5, position: 'relative',
          padding: '1.5rem 1.25rem',
          backgroundColor: 'white', boxShadow: Style.modalShadow
        }
      },
      [
        title && div({ style: { display: 'flex', alignItems: 'baseline', marginBottom: '1rem' } }, [
          div({ style: { fontSize: 18, fontWeight: 500, color: Style.colors.title } }, [title]),
          ...titleExtras,
          showX && div({ style: { flex: 1 } }),
          showX && h(Interactive, {
            as: icon('times-circle'),
            style: { alignSelf: 'flex-start' },
            onClick: onDismiss
          })
        ]),
        children,
        div({
          style: {
            flexShrink: 0, marginTop: '1rem',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline'
          }
        }, [
          showCancel ?
            buttonSecondary({
              style: { marginRight: '1rem' },
              onClick: onDismiss
            }, 'Cancel') :
            null,
          Utils.cond(
            [okButton === undefined, () => buttonPrimary({ onClick: onDismiss }, 'OK')],
            [_.isString(okButton), () => buttonPrimary({ onClick: onDismiss }, okButton)],
            [_.isFunction(okButton), () => buttonPrimary({ onClick: okButton }, 'OK')],
            () => okButton
          )
        ])
      ])
    ])

    return ReactDOM.createPortal(component, this.el)
  }

  componentWillUnmount() {
    document.getElementById('root').classList.remove('overlayOpen', 'overHeight')
    window.removeEventListener('keydown', this.listenForEscape)
    modalRoot.removeChild(this.el)
  }
}
