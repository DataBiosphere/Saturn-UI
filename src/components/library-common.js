import _ from 'lodash/fp'
import { Fragment } from 'react'
import { h } from 'react-hyperscript-helpers'
import { tabBar } from 'src/components/common'
import TopBar from 'src/components/TopBar'
import * as Nav from 'src/libs/nav'


const TAB_LINKS = { 'datasets': 'library-datasets', 'showcase & tutorials': 'library-showcase', 'code & workflows': 'library-code' }

export const libraryTopMatter = activeTab => h(Fragment, [
  h(TopBar, { title: 'Library', href: Nav.getLink('root') }),
  tabBar({
    activeTab,
    tabNames: _.keys(TAB_LINKS),
    getHref: currentTab => Nav.getLink(TAB_LINKS[currentTab])
  })
])
