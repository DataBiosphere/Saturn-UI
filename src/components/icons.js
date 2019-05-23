import '@webcomponents/custom-elements' // this needs to be first, basically only for FF ESR now

import '@clr/icons'
import '@clr/icons/clr-icons.css'
import '@clr/icons/shapes/all-shapes'

import _ from 'lodash/fp'
import { h, img } from 'react-hyperscript-helpers'
import { linkButton } from 'src/components/common'
import hexButton from 'src/icons/hex-button.svg'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { isTerra } from 'src/libs/config'
import iconDict from 'src/libs/icon-dict'


/**
 * Creates a Clarity icon.
 * @param {string} shape - see {@link https://vmware.github.io/clarity/icons/icon-sets}
 * @param {object} [props]
 */
export const icon = (shape, { size = 16, className, ...props } = {}) => iconDict[shape] ?
  iconDict[shape]({ size, className, ...props }) :
  h('clr-icon', { shape, size, class: className, ...props })

export const breadcrumb = props => icon('angle right', _.merge({ size: 10, style: { margin: '0 0.25rem' } }, props))

export const spinner = props => icon('loadingSpinner', _.merge({ size: 24, style: { color: colors.primary() } }, props))

export const centeredSpinner = props => spinner(_.merge({ size: 48, style: { display: 'block', margin: 'auto' } }, props))

export const profilePic = ({ size, style, ...props } = {}) => img({
  src: getUser().imageUrl,
  height: size, width: size,
  style: { borderRadius: '100%', ...style },
  ...props
})

export const iconButton = (shape, { disabled, size, iconProps = {}, ...props } = {}) => linkButton(
  _.merge({
    as: 'span',
    disabled,
    style: {
      height: size, width: isTerra() ? (size * 0.9) : size,
      display: 'flex', alignItems: 'center', alignSelf: 'flex-end', justifyContent: 'center',
      backgroundColor: disabled ? colors.dark(0.15) : colors.accent(),
      ...(isTerra() ?
        { maskImage: `url(${hexButton})`, WebkitMaskImage: `url(${hexButton})` } :
        { borderRadius: '1rem' })
    }
  }, props),
  [icon(shape, _.merge({ style: { color: disabled ? colors.dark() : 'white' } }, iconProps))]
)
