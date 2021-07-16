import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { UnmountClosed as RCollapse } from 'react-collapse'
import { a, div, h, label } from 'react-hyperscript-helpers'
import { ButtonSecondary, Clickable, IdContainer, Select } from 'src/components/common'
import FooterWrapper from 'src/components/FooterWrapper'
import { centeredSpinner, icon } from 'src/components/icons'
import { DelayedSearchInput } from 'src/components/input'
import { libraryTopMatter } from 'src/components/library-common'
import covidBg from 'src/images/library/showcase/covid-19.jpg'
import featuredBg from 'src/images/library/showcase/featured-workspace.svg'
import gatkLogo from 'src/images/library/showcase/gatk-logo-light.svg'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const styles = {
  column: { marginRight: '1.5rem', flex: '1 1 0px', maxWidth: 415 },
  header: {
    fontSize: 16, color: colors.dark(), fontWeight: 'bold',
    marginBottom: '1rem'
  },
  nav: {
    background: {
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
      overflow: 'auto', cursor: 'pointer',
      zIndex: 2
    },
    container: state => ({
      ...(state === 'entered' ? {} : { opacity: 0, transform: 'translate(-2rem)' }),
      transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
      display: 'flex', flexDirection: 'column'
    }),
    navSection: {
      flex: 'none', height: 50, padding: '0 28px', fontWeight: 600,
      borderTop: `1px solid ${colors.dark(0.55)}`
    }
  },
  pill: {
    width: '3rem', padding: '0.1rem', textAlign: 'center',
    border: '1px solid', borderColor: colors.dark(0.25), borderRadius: '0.7rem / 50%',
    backgroundColor: 'white'
  },
  hilightedPill: {
    width: '3rem', padding: '0.1rem', textAlign: 'center',
    border: '1px solid', borderColor: colors.primary(1), borderRadius: '0.7rem / 50%',
    backgroundColor: colors.primary(1), color: 'white'
  }
}

const NavItem = ({ children, ...props }) => {
  return h(Clickable, _.merge({
    style: { display: 'flex', alignItems: 'center', outlineOffset: -4 }
  }, props), [children])
}

const makeCard = variant => workspace => {
  const { namespace, name, created, description } = workspace
  return a({
    href: Nav.getLink('workspace-dashboard', { namespace, name }),
    style: {
      backgroundColor: 'white',
      height: 175,
      borderRadius: 5,
      display: 'flex',
      marginBottom: '1rem',
      boxShadow: Style.standardShadow
    }
  }, [
    div({
      style: {
        backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'auto 100%', borderRadius: '5px 0 0 5px',
        width: 87,
        ...Utils.cond(
          [name.toLowerCase().includes('covid'), () => ({ backgroundImage: `url(${covidBg})` })],
          [variant === 'gatk', () => ({ backgroundColor: '#333', backgroundImage: `url(${gatkLogo})`, backgroundSize: undefined })],
          () => ({ backgroundImage: `url(${featuredBg})`, opacity: 0.75 })
        )
      }
    }),
    div({ style: { flex: 1, minWidth: 0, padding: '15px 20px', overflow: 'hidden' } }, [
      div({ style: { display: 'flex' } }, [
        div({ style: { flex: 1, color: colors.accent(), fontSize: 16, lineHeight: '20px', height: 40, marginBottom: 7 } }, [name]),
        created && div([Utils.makeStandardDate(created)])
      ]),
      div({ style: { lineHeight: '20px', height: 100, whiteSpace: 'pre-wrap', overflow: 'hidden' } }, [description])
      // h(MarkdownViewer, [description]) // TODO: should we render this as markdown?
    ])
  ])
}

// collapsible section for sidebar categories
const sideBarCollapser = ({ titleIcon, title, isOpened, onClick, children }) => {
  return div({
    role: 'group'
  }, [
    h(NavItem, {
      onClick,
      style: styles.nav.navSection
    }, [
      title,
      div({ style: { flexGrow: 1 } }),
      icon(isOpened ? 'angle-up' : 'angle-down', { size: 18, style: { flex: 'none' } })
    ]),
    div({
      style: { flex: 'none' }
    }, [h(RCollapse, { isOpened }, [children])])
  ])
}

// match tags case-insensitively
const sideBarSections = [
  {
    name: 'Getting Started',
    labels: ['Workflow Tutorials', 'Notebook Tutorials', 'Data Tutorials', 'RStudio Tutorials', 'Galaxy Tutorials']
  },
  {
    name: 'Analysis Tools',
    labels: ['WDLs', 'Jupyter Notebooks', 'RStudio', 'Galaxy', 'Hail', 'Bioconductor', 'GATK', 'Cumulus', 'Spark']
  },
  {
    name: 'Experimental Strategy',
    labels: ['GWAS', 'Exome Analysis', 'Whole Genome Analysis', 'Fusion Transcript Detection', 'RNA Analysis', 'Machine Learning',
      'Variant Discovery', 'Epigenomics', 'DNA Methylation', 'Copy Number Variation', 'Structural Variation', 'Functional Annotation']
  },
  {
    name: 'Data Generation Technology',
    labels: ['10x analysis', 'Bisulfate Sequencing']
  },
  {
    name: 'Scientific Domain',
    labels: ['Cancer', 'Infectious Diseases', 'MPG', 'Single-cell', 'Immunology']
  },
  {
    name: 'Datasets',
    labels: ['AnVIL', 'CMG', 'CCDG', 'TopMed', 'HCA', 'TARGET', 'ENCODE', 'BioData Catalyst', 'TCGA', '1000 Genomes', 'BRAIN Initiative',
      'gnomAD', 'NCI', 'COVID-19']
  },
  {
    name: 'Utilities',
    labels: ['Format Conversion', 'Developer Tools']
  },
  {
    name: 'Projects',
    labels: ['HCA', 'AnVIL', 'BRAIN Initiative', 'BioData Catalyst', 'NCI']
  }
]

const Sidebar = props => {
  const { onFilterChange, featuredList, tagFilters } = props

  // setup open-ness state for each sidebar section
  const initialOpenStates = _.fromPairs(_.map(sideBarSections, section => [section.name, true]))
  const [openState, setOpenState] = useState(initialOpenStates)

  const labelCounts = new Map()
  sideBarSections.forEach(section => {
    section.labels.forEach(label => {
      labelCounts.set(_.toLower(label), 0)
    })
  })

  featuredList.forEach(workspace => {
    workspace.tags.items?.forEach(tag => {
      tag = tag.toLowerCase()
      if (labelCounts.has(tag)) {
        labelCounts.set(tag, labelCounts.get(tag) + 1)
      }
    })
  })

  return div({ style: { display: 'flex', flexDirection: 'column' } }, [
    _.map(section => {
      return div([
        h(sideBarCollapser,
          {
            title: section.name,
            onClick: () => setOpenState(_.update(section.name, open => !open, openState)),
            isOpened: openState[section.name]
          },
          [
            ..._.map(label => {
              const count = labelCounts.get(_.toLower(label))
              return count > 0 && div({ style: { marginBottom: '0.5rem', display: 'flex' } }, [
                h(Clickable, {
                  style: { flex: 1 },
                  onClick: () => onFilterChange(label.toLowerCase())
                }, [label]),
                div({ style: _.includes(_.toLower(label), tagFilters) ? styles.hilightedPill : styles.pill }, count)
              ])
            }, section.labels)
          ]
        )
      ])
    }, sideBarSections)
  ])
}

const Showcase = () => {
  const stateHistory = StateHistory.get()
  const [featuredList, setFeaturedList] = useState(stateHistory.featuredList)

  const [tagFilters, setTagFilters] = useState([])
  const [searchFilter, setSearchFilter] = useState()
  const [sort, setSort] = useState('most recent')

  Utils.useOnMount(() => {
    const loadData = async () => {
      const featuredList = await Ajax().Buckets.getShowcaseWorkspaces()

      setFeaturedList(featuredList)
      StateHistory.update({ featuredList })
    }

    loadData()
  })

  const matchWorkspace = workspace => {
    const lowerWorkspaceTags = _.map(_.toLower, workspace.tags.items)
    const lowerTagFilters = _.map(_.toLower, tagFilters)
    return (_.isEmpty(tagFilters) || _.every(t => _.includes(t, lowerWorkspaceTags), lowerTagFilters)) &&
      (!searchFilter || _.includes(searchFilter, workspace.name) || _.includes(searchFilter, workspace.description))
  }
  const filteredWorkspaces = _.filter(matchWorkspace, featuredList)

  const sortWorkspaces = Utils.cond(
    [sort === 'most recent', () => _.orderBy(['created'], ['desc'])],
    [sort === 'alphabetical', () => _.orderBy(w => _.toLower(_.trim(w.name)), ['asc'])],
    () => _.identity
  )
  const sortedWorkspaces = sortWorkspaces(filteredWorkspaces)

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('showcase & tutorials'),
    !featuredList ?
      centeredSpinner() :
      h(Fragment, [
        div({ style: { display: 'flex', margin: '1rem 1rem 0', alignItems: 'baseline' } }, [
          div({ style: { width: '18rem', flex: '0 0 auto' } }, [
            div({ style: styles.header }, 'Featured workspaces'),
            div({ style: { display: 'flex', alignItems: 'center', height: '2.5rem' } }, [
              ..._.map(tag => {
                return div({ style: { display: 'flex', alignItems: 'center', marginRight: '0.5rem' } }, [
                  h(ButtonSecondary, {
                    onClick: () => setTagFilters(_.without([tag], tagFilters))
                  }, [icon('times')]),
                  tag
                ])
              }, tagFilters),
              div({ style: { flex: 1 } }),
              h(Clickable, {
                onClick: () => setTagFilters([])
              }, ['clear'])
            ])
          ]),
          h(DelayedSearchInput, {
            style: { flex: 1, marginLeft: '1rem' },
            'aria-label': 'Search Featured Workspaces',
            placeholder: 'Search Name or Description',
            value: searchFilter,
            onChange: setSearchFilter
          }),
          h(IdContainer, [
            id => h(Fragment, [
              label({ htmlFor: id, style: { margin: '0 0.5rem 0 1rem', whiteSpace: 'nowrap' } }, ['Sort by']),
              h(Select, {
                id,
                isClearable: false,
                isSearchable: false,
                styles: { container: old => ({ ...old, width: '10rem' }) },
                value: sort,
                onChange: v => setSort(v.value),
                options: ['most recent', 'alphabetical']
              })
            ])
          ])
        ]),
        div({ style: { display: 'flex', margin: '0 1rem' } }, [
          div({ style: { width: '18rem', flex: '0 0 auto' } }, [
            h(Sidebar, {
              onFilterChange: tag => setTagFilters(_.uniq([...tagFilters, tag])),
              featuredList,
              tagFilters
            })
          ]),
          div({ style: { marginLeft: '1rem', minWidth: 0 } }, [
            ..._.map(makeCard(), sortedWorkspaces)
          ])
        ])
      ])
  ])
}

export const navPaths = [
  {
    name: 'library-showcase',
    path: '/library/showcase',
    component: Showcase,
    title: 'Showcase & Tutorials',
    public: true
  }
]
