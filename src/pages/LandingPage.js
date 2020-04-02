import { Fragment } from 'react'
import { div, h, h2 } from 'react-hyperscript-helpers'
import { Clickable, HeroWrapper, Link, makeIconButton } from 'src/components/common'
import { icon } from 'src/components/icons'
import covidHero from 'src/images/covid-hero.jpg'
import colors from 'src/libs/colors'
import { isFirecloud, isTerra } from 'src/libs/config'
import * as Nav from 'src/libs/nav'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const makeDocLink = (href, title) => {
  return div({
    style: { marginBottom: '1rem', fontSize: 18, width: 600 }
  }, [
    h(Link, {
      href,
      ...Utils.newTabLinkProps,
      style: { fontSize: 18 }
    }, [
      title,
      icon('pop-out', { size: 18, style: { marginLeft: '0.5rem' } })
    ])
  ])
}

const makeCard = (link, title, body) => h(Clickable, {
  href: Nav.getLink(link),
  style: { ...Style.elements.card.container, height: 245, width: 225, marginRight: '1rem', justifyContent: undefined },
  hover: { boxShadow: '0 3px 7px 0 rgba(0,0,0,0.5), 0 5px 3px 0 rgba(0,0,0,0.2)' }
}, [
  div({ style: { color: colors.accent(), fontSize: 18, fontWeight: 500, lineHeight: '22px', marginBottom: '0.5rem' } }, title),
  div({ style: { lineHeight: '22px' } }, body),
  div({ style: { flexGrow: 1 } }),
  makeIconButton('arrowRight', { tabIndex: '-1', 'aria-hidden': true, size: 30, style: { alignSelf: 'flex-end' } })
])

const LandingPage = () => {
  return h(HeroWrapper, { bigSubhead: true }, [
    makeDocLink('https://support.terra.bio/hc/en-us', 'Find how-to\'s, documentation, video tutorials, and discussion forums'),
    isTerra() && makeDocLink('https://support.terra.bio/hc/en-us/articles/360033416672',
      'Learn more about the Terra platform and our co-branded sites'),
    isFirecloud() && h(Fragment, [
      makeDocLink('https://support.terra.bio/hc/en-us/articles/360022694271',
        'Already a FireCloud user? Learn what\'s new.'),
      makeDocLink('https://support.terra.bio/hc/en-us/articles/360033416912',
        'Learn more about the Cancer Research Data Commons and other NCI Cloud Resources')
    ]),
    div({
      style: { display: 'flex', margin: '2rem 0 1rem 0' }
    }, [
      makeCard('workspaces', 'View Workspaces', [
        'Workspaces connect your data to popular analysis tools powered by the cloud. Use Workspaces to share data, code, and results easily and securely.'
      ]),
      makeCard('library-showcase', 'View Examples', 'Browse our gallery of showcase Workspaces to see how science gets done.'),
      makeCard('library-datasets', 'Browse Data', 'Access data from a rich ecosystem of data portals.')
    ]),
    isTerra() && div({
      style: {
        backgroundImage: `url(${covidHero})`, backgroundSize: 'cover', borderRadius: 5,
        boxShadow: '0 2px 5px 0 rgba(0,0,0,0.35), 0 3px 2px 0 rgba(0,0,0,0.12)',
        color: 'white', padding: '2rem 1rem',
        width: 'calc(675px + 2rem)' // 3 card widths + 2 card margins to line up with the content directly above
      }
    }, [
      h2({ style: { fontSize: 18, fontWeight: 500, lineHeight: '22px', margin: 0 } }, ['Data & Tools for COVID-19/SARS CoV2 analysis']),
      h(Clickable, {
        href: 'https://support.terra.bio/hc/en-us/articles/360041068771--COVID-19-workspaces-data-and-tools-in-Terra',
        style: { textDecoration: 'underline' },
        ...Utils.newTabLinkProps
      }, ['See this article']),
      ' for a summary of available resources.'
    ]),
    (isTerra() || isFirecloud()) && div({ style: { width: 700, marginTop: '4rem' } }, [
      'This project has been funded in whole or in part with Federal funds from the National Cancer Institute, National Institutes of Health, ',
      'Task Order No. 17X053 under Contract No. HHSN261200800001E'
    ])
  ])
}


export const navPaths = [
  {
    name: 'root',
    path: '/',
    component: LandingPage,
    public: true
  }
]
