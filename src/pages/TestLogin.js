import { useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { buttonPrimary } from 'src/components/common'
import { TextInput } from 'src/components/input'
import * as Nav from 'src/libs/nav'


const TestLogin = () => {
  const [token, setToken] = useState('')

  return div({ style: { margin: '2rem', display: 'flex', alignItems: 'center' } }, [
    'Token:',
    h(TextInput, {
      style: { margin: '0 1rem' },
      value: token,
      onChange: setToken
    }),
    buttonPrimary({
      onClick: async () => {
        await window.forceSignIn(token)
        Nav.goToPath('root')
      }
    }, 'Force sign-in')
  ])
}

export const navPaths = [
  {
    name: 'test-login',
    path: '/test-login',
    component: TestLogin,
    public: true,
    title: 'Test Login'
  }
]
