import _ from 'lodash/fp'
import { useState } from 'react'
import { div, h, h2 } from 'react-hyperscript-helpers'
import FooterWrapper from 'src/components/FooterWrapper'
import { MarkdownViewer } from 'src/components/markdown'
import SignInButton from 'src/components/SignInButton'
import TopBar from 'src/components/TopBar'
import { Ajax } from 'src/libs/ajax'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const signInStyle = {
  backgroundColor: 'white',
  padding: '1rem 1rem',
  marginTop: '2rem',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 5,
  textAlign: 'center',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 20
}
//render
const DashboardPublic = ({ namespace, name }) => {
  const stateHistory = StateHistory.get()
  const [showcaseList, setShowcaseList] = useState(stateHistory.featuredList)

  Utils.useOnMount(() => {
    const loadData = async () => {
      const showcaseList = await Ajax().Buckets.getShowcaseWorkspaces()

      setShowcaseList(showcaseList)
      StateHistory.update({ showcaseList })
    }

    loadData()
  })

  const workspace = _.find({ namespace, name }, showcaseList)
  const description = !workspace ? '' : workspace['description']

  return h(FooterWrapper, [
    h(TopBar, [
      div({ style: Style.breadcrumb.breadcrumb }, [
        h2({ style: Style.breadcrumb.textUnderBreadcrumb }, [
          `${namespace}/${name}`
        ])
      ])
    ]),
    div({ style: { flex: 1, display: 'flex' } }, [
      div({ style: Style.dashboard.leftBox }, [
        div({ style: Style.dashboard.header }, [
          'About the workspace'
        ]),
        !!description && h(MarkdownViewer, [description])
      ]),
      div({ style: Style.dashboard.rightBox }, [
        div({ style: signInStyle },
          [
            'Sign in to view full workspace',
            h(SignInButton, { theme: 'dark' })
          ]
        )
      ])
    ])
  ])
}

export default DashboardPublic
