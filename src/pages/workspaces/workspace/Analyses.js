import * as clipboard from 'clipboard-polyfill/text'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { Fragment, useEffect, useState } from 'react'
import { a, div, h, img, label } from 'react-hyperscript-helpers'
import * as breadcrumbs from 'src/components/breadcrumbs'
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/components/bucket-utils'
import { ViewToggleButtons, withViewToggle } from 'src/components/CardsListToggle'
import {
  ButtonOutline,
  ButtonPrimary,
  Clickable,
  IdContainer,
  Link,
  PageBox,
  Select,
  spinnerOverlay
} from 'src/components/common'
import Dropzone from 'src/components/Dropzone'
import { icon } from 'src/components/icons'
import { DelayedSearchInput } from 'src/components/input'
import { NewAnalysisModal } from 'src/components/NewAnalysisModal'
import {
  AnalysisDeleter,
  AnalysisDuplicator,
  findPotentialNotebookLockers,
  getDisplayName,
  getFileName,
  getTool,
  notebookLockHash,
  stripExtension,
  tools
} from 'src/components/notebook-utils'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import TooltipTrigger from 'src/components/TooltipTrigger'
import galaxyLogo from 'src/images/galaxy-logo.png'
import jupyterLogo from 'src/images/jupyter-logo.svg'
import rLogo from 'src/images/r-logo.svg'
import rstudioLogo from 'src/images/rstudio-logo.svg'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError, withErrorReporting } from 'src/libs/error'
import * as Nav from 'src/libs/nav'
import { notify } from 'src/libs/notifications'
import { authStore } from 'src/libs/state'
import * as StateHistory from 'src/libs/state-history'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import ExportAnalysisModal from 'src/pages/workspaces/workspace/notebooks/ExportNotebookModal'
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer'


const analysisCardCommonStyles = listView => _.merge({ display: 'flex' },
  listView ?
    {
      marginBottom: '0.5rem',
      flexDirection: 'row',
      alignItems: 'center'
    } :
    {
      margin: '0 2.5rem 2.5rem 0',
      height: 100,
      width: 400,
      flexDirection: 'column',
      padding: 0
    }
)

const noWrite = 'You do not have access to modify this workspace.'

const sortTokens = {
  lowerCaseName: notebook => notebook.name.toLowerCase()
}
const defaultSort = { label: 'Most Recently Updated', value: { field: 'updated', direction: 'desc' } }
const sortOptions = [
  defaultSort,
  { label: 'Least Recently Updated', value: { field: 'updated', direction: 'asc' } },
  { label: 'Alphabetical', value: { field: 'lowerCaseName', direction: 'asc' } },
  { label: 'Reverse Alphabetical', value: { field: 'lowerCaseName', direction: 'desc' } }
]

const AnalysisCard = ({ namespace, name, updated, metadata, toolLabel, listView, wsName, onRename, onCopy, onDelete, onExport, canWrite, currentUserHash, potentialLockers }) => {
  const { lockExpiresAt, lastLockedBy } = metadata || {}
  const lockExpirationDate = new Date(parseInt(lockExpiresAt))
  const locked = currentUserHash && lastLockedBy && lastLockedBy !== currentUserHash && lockExpirationDate > Date.now()
  const lockedBy = potentialLockers ? potentialLockers[lastLockedBy] : null

  const analysisLink = Nav.getLink('workspace-analysis-launch', { namespace, name: wsName, analysisName: getFileName(name) })

  const analysisEditLink = `${analysisLink}/?${qs.stringify({ mode: 'edit' })}`
  const analysisPlaygroundLink = `${analysisLink}/?${qs.stringify({ mode: 'playground' })}`

  const analysisMenu = h(MenuTrigger, {
    side: 'right',
    closeOnClick: true,
    content: h(Fragment, [
      h(MenuButton, {
        href: analysisLink,
        tooltip: canWrite && 'Open without cloud compute',
        tooltipSide: 'left'
      }, [makeMenuIcon('eye'), 'Open preview']),
      h(MenuButton, {
        href: analysisEditLink,
        disabled: locked || !canWrite,
        tooltip: !canWrite && noWrite,
        tooltipSide: 'left'
      }, locked ? [makeMenuIcon('lock'), 'Edit (In Use)'] : [makeMenuIcon('edit'), 'Edit']),
      h(MenuButton, {
        href: analysisPlaygroundLink,
        tooltip: canWrite && 'Open in playground mode',
        tooltipSide: 'left'
      }, [makeMenuIcon('chalkboard'), 'Playground']),
      h(MenuButton, {
        disabled: !canWrite,
        tooltip: !canWrite && noWrite,
        tooltipSide: 'left',
        onClick: () => onCopy()
      }, [makeMenuIcon('copy'), 'Make a copy']),
      h(MenuButton, {
        onClick: () => onExport()
      }, [makeMenuIcon('export'), 'Copy to another workspace']),
      h(MenuButton, {
        onClick: async () => {
          try {
            await clipboard.writeText(`${window.location.host}/${analysisLink}`)
            notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 })
          } catch (error) {
            reportError('Error copying to clipboard', error)
          }
        }
      }, [makeMenuIcon('copy-to-clipboard'), 'Copy analysis URL to clipboard']),
      h(MenuButton, {
        disabled: !canWrite,
        tooltip: !canWrite && noWrite,
        tooltipSide: 'left',
        onClick: () => onRename()
      }, [makeMenuIcon('renameIcon'), 'Rename']),
      h(MenuButton, {
        disabled: !canWrite,
        tooltip: !canWrite && noWrite,
        tooltipSide: 'left',
        onClick: () => onDelete()
      }, [makeMenuIcon('trash'), 'Delete'])
    ])
  }, [
    h(Link, { 'aria-label': 'Analyses menu', onClick: e => e.preventDefault() }, [
      icon('ellipsis-v', {
        size: listView ? 18 : 16
      })
    ])
  ])

  const title = div({
    title: getDisplayName(name),
    style: _.merge({
      ...Style.elements.card.title, whiteSpace: 'normal', overflowY: 'auto'
    }, listView ? {
      marginLeft: '1rem', flexGrow: 1
    } : { height: 60, padding: '1rem' })
  }, getDisplayName(name))

  const appIconSrc = Utils.switchCase(toolLabel, [tools.Jupyter.label, () => jupyterLogo], [tools.RStudio.label, () => rLogo])
  const appIcon = div({ style: { marginRight: '1rem' } }, [
    img({ src: appIconSrc, style: { height: 40, width: 40 } })
  ])

  return a({
    href: analysisLink,
    style: {
      ...Style.elements.card.container,
      ...analysisCardCommonStyles(listView),
      flexShrink: 0
    }
  }, listView ? [
    appIcon,
    toolLabel,
    title,
    div({ style: { flexGrow: 1 } }),
    locked && h(Clickable, {
      style: { display: 'flex', paddingRight: '1rem', color: colors.dark(0.75) },
      tooltip: `This analysis is currently being edited by ${lockedBy || 'another user'}`
    }, [icon('lock')]),
    h(TooltipTrigger, { content: Utils.makeCompleteDate(updated) }, [
      div({ style: { fontSize: '0.8rem', marginRight: '0.5rem' } },
        `Last edited: ${Utils.makePrettyDate(updated)}`)
    ]),
    analysisMenu
  ] : [
    div({ style: { display: 'flex' } }, [
      title,
      div({ style: { flexGrow: 1 } }),
      locked && h(Clickable, {
        style: { display: 'flex', padding: '1rem', color: colors.dark(0.75) },
        tooltip: `This analysis is currently being edited by ${lockedBy || 'another user'}`
      }, [icon('lock')])
    ]),
    div({
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `solid 1px ${colors.dark(0.4)}`,
        paddingLeft: '0.5rem', paddingRight: '0.5rem', height: '2.5rem',
        backgroundColor: colors.light(0.4),
        borderRadius: '0 0 5px 5px'
      }
    }, [
      h(TooltipTrigger, { content: Utils.makeCompleteDate(updated) }, [
        div({ style: { fontSize: '0.8rem', marginRight: '0.5rem' } }, [
          'Last edited: ',
          Utils.makePrettyDate(updated)
        ])
      ]),
      analysisMenu
    ])
  ])
}

const Analyses = _.flow(
  Utils.forwardRefWithName('Analyses'),
  requesterPaysWrapper({
    onDismiss: () => Nav.history.goBack()
  }),
  wrapWorkspace({
    breadcrumbs: props => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Analyses', activeTab: 'analyses'
  }),
  withViewToggle('analysesTab')
)(({
  apps, name: wsName, namespace, workspace, workspace: { accessLevel, canShare, workspace: { bucketName } },
  refreshApps, onRequesterPaysError, listView, setListView, runtimes,
  persistentDisks,
  refreshRuntimes,
  galaxyDataDisks
}) => {
  // State
  const [renamingAnalysisName, setRenamingAnalysisName] = useState(undefined)
  const [copyingAnalysisName, setCopyingAnalysisName] = useState(undefined)
  const [deletingAnalysisName, setDeletingAnalysisName] = useState(undefined)
  const [exportingAnalysisName, setExportingAnalysisName] = useState(undefined)
  const [sortOrder, setSortOrder] = useState(() => StateHistory.get().sortOrder || defaultSort.value)
  const [filter, setFilter] = useState(() => StateHistory.get().filter || '')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  //TODO: add galaxy artefacts to this once we have galaxy artefacts
  const [analyses, setAnalyses] = useState(() => StateHistory.get().analyses || undefined)
  const [currentUserHash, setCurrentUserHash] = useState(undefined)
  const [potentialLockers, setPotentialLockers] = useState(undefined)

  const authState = Utils.useStore(authStore)
  const signal = Utils.useCancellation()

  // Helpers
  //TODO: does this prevent users from making an .Rmd with the same name as an .ipynb?
  const existingNames = _.map(({ name }) => getDisplayName(name), analyses)

  const refreshAnalyses = _.flow(
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error loading analyses'),
    Utils.withBusyState(setBusy)
  )(async () => {
    const notebooks = await Ajax(signal).Buckets.listNotebooks(namespace, bucketName)
    const enhancedNotebooks = _.map(notebook => _.merge(notebook, { toolLabel: tools.Jupyter.label }), notebooks)
    const rmds = await Ajax(signal).Buckets.listRmds(namespace, bucketName)
    const enhancedRmd = _.map(rmd => _.merge(rmd, { toolLabel: tools.RStudio.label }), rmds)
    const analyses = _.concat(enhancedNotebooks, enhancedRmd)
    setAnalyses(_.reverse(_.sortBy('updated', analyses)))
  })

  //TODO: eventually load app artefacts
  // const doAppRefresh = _.flow(
  //   withErrorReporting('Error loading Apps'),
  //   Utils.withBusyState(setBusy)
  // )(refreshApps)

  const uploadFiles = Utils.withBusyState(setBusy, async files => {
    try {
      await Promise.all(_.map(async file => {
        const name = stripExtension(file.name)
        const toolLabel = getTool(file.name)
        let resolvedName = name
        let c = 0
        while (_.includes(resolvedName, existingNames)) {
          resolvedName = `${name} ${++c}`
        }
        const contents = await Utils.readFileAsText(file)
        return Ajax().Buckets.analysis(namespace, bucketName, resolvedName, toolLabel).create(contents)
      }, files))
      refreshAnalyses()
    } catch (error) {
      if (error instanceof SyntaxError) {
        reportError('Error uploading analysis', 'This file is not formatted correctly, ensure it has the correct extension')
      } else {
        reportError('Error creating analysis', error)
      }
    }
  })

  // Lifecycle
  Utils.useOnMount(() => {
    const load = async () => {
      const [currentUserHash, potentialLockers] = await Promise.all(
        [notebookLockHash(bucketName, authState.user.email), findPotentialNotebookLockers({ canShare, namespace, wsName, bucketName })])
      setCurrentUserHash(currentUserHash)
      setPotentialLockers(potentialLockers)
      refreshAnalyses()
    }

    load()
  })

  useEffect(() => {
    StateHistory.update({ analyses, sortOrder, filter })
  }, [analyses, sortOrder, filter])

  const noAnalysisBanner = div([
    div({ style: { fontSize: 48 } }, ['A place for all your analyses ']),
    div({ style: { display: 'flex', flexDirection: 'row' } }, [
      img({ src: jupyterLogo, style: { height: 150, width: 100, marginRight: '12rem' } }),
      img({ src: rstudioLogo, style: { height: 150, width: 170, marginRight: '10rem' } }),
      div([
        img({ src: galaxyLogo, style: { height: 75, width: 260, marginTop: '2.5rem' } })
        // span({ style: { marginTop: '3.5rem'} }, ['Galaxy'])
      ])
    ]),
    //TODO, check with Joy, wording change (it may not be their first, just first in this workspace)
    div({ style: { marginTop: '1rem', fontSize: 20 } }, [
      `Select one of the applications above to create an analysis.`
    ])
  ])

  // Render helpers
  const renderAnalyses = () => {
    const { field, direction } = sortOrder
    const canWrite = Utils.canWrite(accessLevel)
    const renderedAnalyses = _.flow(
      _.filter(({ name }) => Utils.textMatch(filter, getDisplayName(name))),
      _.orderBy(sortTokens[field] || field, direction),
      _.map(({ name, updated, metadata, toolLabel }) => h(AnalysisCard, {
        key: name,
        name, updated, metadata, toolLabel, listView, namespace, wsName, canWrite, currentUserHash, potentialLockers,
        onRename: () => setRenamingAnalysisName(name),
        onCopy: () => setCopyingAnalysisName(name),
        onExport: () => setExportingAnalysisName(name),
        onDelete: () => setDeletingAnalysisName(name)
      }))
    )(analyses)

    return div({
      style: {
        ..._.merge({ textAlign: 'center', display: 'flex', justifyContent: 'center' }, _.isEmpty(analyses) ? { alignItems: 'center', height: '80%' } : {})
      }
    }, [
      Utils.cond(
        [_.isEmpty(analyses), () => noAnalysisBanner],
        [!_.isEmpty(analyses) && _.isEmpty(renderedAnalyses), () => {
          return div({ style: { fontStyle: 'italic' } }, ['No matching analyses'])
        }],
        [listView, () => div({ style: { flex: 1 } }, [renderedAnalyses])],
        () => div({ style: { display: 'flex', flexWrap: 'wrap' } }, renderedAnalyses)
      )
    ])
  }

  // Render
  return h(Dropzone, {
    accept: `.${tools.Jupyter.ext}, .${tools.RStudio.ext}`,
    disabled: !Utils.canWrite(accessLevel),
    style: { flexGrow: 1 },
    activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
    onDropRejected: () => reportError('Not a valid analysis file',
      'The selected file is not a .ipynb notebook file or an .Rmd rstudio file. Ensure your file has the proper extension.'),
    onDropAccepted: uploadFiles
  }, [({ openUploader }) => h(Fragment, [
    analyses && h(PageBox, { style: { height: '100%' } }, [
      div({ style: { display: 'flex', marginBottom: '1rem' } }, [
        div({ style: { color: colors.dark(), fontSize: 24, fontWeight: 600 } }, ['Your Analyses']),
        h(ButtonOutline, {
          style: {
            marginLeft: '6.5rem'
          },
          onClick: () => setCreating(true),
          disabled: !Utils.canWrite(accessLevel),
          tooltip: !Utils.canWrite(accessLevel) ? noWrite : undefined
        }, [
          icon('plus', { size: 14, style: { color: colors.accent() } }),
          div({ style: { marginLeft: '0.5rem' } }, ['Create'])
        ]),
        h(ButtonPrimary, {
          style: {
            marginLeft: '1rem'
          },
          onClick: openUploader,
          disabled: !Utils.canWrite(accessLevel),
          tooltip: !Utils.canWrite(accessLevel) ? noWrite : undefined
        }, [
          div({ style: { marginBottom: '0.5rem' } }, [
            icon('upload-cloud', { style: { marginTop: '0.5rem', marginRight: '0.5rem' }, size: 21 }),
            'Upload'
          ])
        ]),
        div({ style: { flex: 2 } }),
        !_.isEmpty(analyses) && h(DelayedSearchInput, {
          'aria-label': 'Search analyses',
          style: { marginRight: '0.75rem', width: 220 },
          placeholder: 'Search analyses',
          onChange: setFilter,
          value: filter
        }),
        !_.isEmpty(analyses) && h(IdContainer, [id => h(Fragment, [
          label({ htmlFor: id, style: { marginLeft: 'auto', marginRight: '0.75rem' } }, ['Sort By:']),
          h(Select, {
            id,
            value: sortOrder,
            isClearable: false,
            styles: { container: old => ({ ...old, width: 220, marginRight: '1.10rem' }) },
            options: sortOptions,
            onChange: selected => setSortOrder(selected.value)
          })
        ])]),
        !_.isEmpty(analyses) && h(ViewToggleButtons, { listView, setListView }),
        //TODO: create impl for analyses. will not live in the same place, but keeping code and state for reference
        h(NewAnalysisModal, {
          isOpen: creating,
          namespace,
          workspace,
          runtimes,
          persistentDisks,
          refreshRuntimes,
          galaxyDataDisks,
          apps,
          refreshApps,
          onDismiss: () => setCreating(false),
          onSuccess: () => setCreating(false)
        }),
        renamingAnalysisName && h(AnalysisDuplicator, {
          printName: getDisplayName(renamingAnalysisName),
          toolLabel: getTool(renamingAnalysisName),
          namespace, wsName, bucketName, destroyOld: true,
          onDismiss: () => setRenamingAnalysisName(undefined),
          onSuccess: () => {
            setRenamingAnalysisName(undefined)
            refreshAnalyses()
          }
        }),
        copyingAnalysisName && h(AnalysisDuplicator, {
          printName: getDisplayName(copyingAnalysisName),
          toolLabel: getTool(copyingAnalysisName),
          namespace, wsName, bucketName, destroyOld: false,
          onDismiss: () => setCopyingAnalysisName(undefined),
          onSuccess: () => {
            setCopyingAnalysisName(undefined)
            refreshAnalyses()
          }
        }),
        exportingAnalysisName && h(ExportAnalysisModal, {
          printName: getDisplayName(exportingAnalysisName),
          toolLabel: getTool(exportingAnalysisName),
          workspace,
          onDismiss: () => setExportingAnalysisName(undefined)
        }),
        deletingAnalysisName && h(AnalysisDeleter, {
          printName: getDisplayName(deletingAnalysisName), namespace, bucketName,
          toolLabel: getTool(deletingAnalysisName),
          onDismiss: () => setDeletingAnalysisName(undefined),
          onSuccess: () => {
            setDeletingAnalysisName(undefined)
            refreshAnalyses()
          }
        })
      ]),
      renderAnalyses()
    ]),
    busy && spinnerOverlay
  ])])
})

export const navPaths = [
  {
    name: 'workspace-analyses',
    path: '/workspaces/:namespace/:name/analyses',
    component: Analyses,
    title: ({ name }) => `${name} - Analysis`
  }
]
