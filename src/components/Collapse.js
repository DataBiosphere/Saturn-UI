import { useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { Link } from 'src/components/common'
import { icon } from 'src/components/icons'


const Collapse = ({ title, buttonStyle, initialOpenState, children, titleFirst, ...props }) => {
  const [isOpened, setIsOpened] = useState(initialOpenState)
  const angleIcon = icon(isOpened ? 'angle-down' : 'angle-right', { style: { marginRight: '0.25rem', flexShrink: 0 } })

  return div(props, [
    h(Link, {
      'aria-expanded': isOpened,
      style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem', ...buttonStyle },
      onClick: () => setIsOpened(!isOpened)
    },
    titleFirst ? [div({ style: { flexGrow: 1 } }, [title]), angleIcon] : [angleIcon, title]
    ),
    isOpened && div([children])
  ])
}

export default Collapse
