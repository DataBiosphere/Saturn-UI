import { h } from 'react-hyperscript-helpers'
import { Clickable } from 'src/components/common'
import * as Utils from 'src/libs/utils'


const SignInButton = (props = { theme: 'light' }) => {
  Utils.useOnMount(() => {
    window.gapi.signin2.render('signInButton', {
      scope: 'openid profile email',
      width: 250,
      height: 56,
      longtitle: true,
      theme: props.theme,
      prompt: 'select_account'
    })
  })

  // For some reason, Google's rendered Sign-In button is not at all keyboard accessible.
  // To fix this, we wrap it as a button, and propagate the keyboard-accessible click event down to
  // the inner DOM node inside the button, then let it bubble up to whatever it is that catches it.
  return h(Clickable, {
    ...props,
    id: 'signInButton',
    onClick: event => {
      const elts = event.target.getElementsByClassName('abcRioButtonContents') // This could potentially be unstable if Google changes their markup
      if (elts.length > 0) {
        elts.item(0).click()
      }
    },
    style: { outlineOffset: 5 }
  })
}

export default SignInButton
