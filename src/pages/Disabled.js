import { div } from 'react-hyperscript-helpers'
import { link } from 'src/components/common'
import { signOut } from 'src/libs/auth'

const Disabled = () => {
  return div({ style: { padding: '1rem' } }, [
    div([
      'Thank you for registering. Your account is currently inactive. ',
      'You will be contacted via email when your account is activated.'
    ]),
    div({ style: { marginTop: '1rem' } }, [
      link({ onClick: signOut }, 'Sign out')
    ])
  ])
}

export default Disabled
