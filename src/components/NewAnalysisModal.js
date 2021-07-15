import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h, hr, img } from 'react-hyperscript-helpers'
import { spinnerOverlay } from 'src/components/common'
import ModalDrawer from 'src/components/ModalDrawer'
import { NewGalaxyModalBase } from 'src/components/NewGalaxyModal'
import { NewRuntimeModalBase } from 'src/components/NewRuntimeModal'
import { tools } from 'src/components/notebook-utils'
import TitleBar from 'src/components/TitleBar'
import galaxyLogo from 'src/images/galaxy-logo.png'
import jupyterLogoLong from 'src/images/jupyter-logo-long.png'
import rstudioLogo from 'src/images/rstudio-logo.svg'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import * as Utils from 'src/libs/utils'

//TODO: title id in titleBar and aria-labelled-by in withModalDrawer

const titleId = 'new-analysis-modal-title'

export const NewAnalysisModal = Utils.withDisplayName('NewAnalysisModal')(
  ({ isOpen, onDismiss, onSuccess, runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps, workspace, persistentDisks, workspace: { workspace: { namespace, bucketName, name: workspaceName } } }) => {
    const [viewMode, setViewMode] = useState(undefined)
    const [busy, setBusy] = useState()

    const renderNewRuntimeModal = tool => h(NewRuntimeModalBase, {
      isOpen: viewMode === NEW_JUPYTER_MODE || viewMode === NEW_RSTUDIO_MODE,
      isAnalysisMode: true,
      workspace,
      tool,
      runtimes,
      persistentDisks,
      onDismiss: () => {
        setViewMode(undefined)
        onDismiss()
      },
      onSuccess: _.flow(
        withErrorReporting('Error creating runtime'),
        Utils.withBusyState(setBusy)
      )(async () => {
        setViewMode(undefined)
        onSuccess()
        await refreshRuntimes(true)
      })
    })

    const renderNewGalaxyModal = () => h(NewGalaxyModalBase, {
      isOpen: viewMode === NEW_GALAXY_MODE,
      isAnalysisMode: true,
      workspace,
      apps,
      galaxyDataDisks,
      onDismiss: () => {
        setViewMode(undefined)
        onDismiss()
      },
      onSuccess: _.flow(
        withErrorReporting('Error creating app'),
        Utils.withBusyState(setBusy)
      )(async () => {
        setViewMode(undefined)
        onSuccess()
        await refreshApps(true)
      })
    })

    const NEW_JUPYTER_MODE = tools.Jupyter.label
    const NEW_RSTUDIO_MODE = tools.RStudio.label
    const NEW_GALAXY_MODE = tools.galaxy.label
    const getView = () => Utils.switchCase(viewMode,
      [NEW_JUPYTER_MODE, () => renderNewRuntimeModal(NEW_JUPYTER_MODE)],
      [NEW_RSTUDIO_MODE, () => renderNewRuntimeModal(NEW_RSTUDIO_MODE)],
      [NEW_GALAXY_MODE, renderNewGalaxyModal],
      [Utils.DEFAULT, renderCreateAnalysisBody]
    )

    const toolCardStyles = { backgroundColor: 'white', borderRadius: 5, padding: '1rem', display: 'inline-block', verticalAlign: 'middle', marginBottom: '1rem', textAlign: 'center', width: '100%', height: 60 }
    const imageStyles = { verticalAlign: 'middle', height: '100%', width: '40%' }

    const renderToolButtons = () => div({ style: { display: 'flex', alignItems: 'center', flexDirection: 'column', justifyContent: 'space-between' } }, [
      div({ style: toolCardStyles, onClick: () => setViewMode(NEW_JUPYTER_MODE) }, [img({ src: jupyterLogoLong, style: _.merge(imageStyles, { width: '30%' }) })]),
      div({ style: toolCardStyles, onClick: () => setViewMode(NEW_RSTUDIO_MODE) }, [img({ src: rstudioLogo, style: imageStyles })]),
      div({ style: toolCardStyles, onClick: () => setViewMode(NEW_GALAXY_MODE) }, [img({ src: galaxyLogo, style: _.merge(imageStyles, { width: '30%' }) })])
    ])

    const renderCreateAnalysisBody = () => div({ style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '.5rem 1.5rem 1.5rem 1.5rem' } }, [
      renderToolButtons()
    ])

    const width = Utils.switchCase(viewMode,
      [NEW_JUPYTER_MODE, () => 675],
      [NEW_RSTUDIO_MODE, () => 675],
      [NEW_GALAXY_MODE, () => 675],
      [Utils.DEFAULT, () => 450]
    )

    const modalBody = h(Fragment, [
      h(TitleBar, {
        id: titleId,
        title: 'Select an application',
        titleStyles: _.merge(viewMode === undefined ? {} : { display: 'none' }, { margin: '1.5rem 0 0 1.5rem' }),
        width,
        onDismiss,
        onPrevious: !!viewMode ? () => setViewMode(undefined) : undefined
      }),
      viewMode !== undefined && hr({ style: { borderTop: '1px solid', width: '100%', color: colors.accent() } }),
      getView(),
      busy && spinnerOverlay
    ])

    const modalProps = {
      isOpen, width, 'aria-labelledby': titleId,
      onDismiss: () => {
        setViewMode(undefined)
        onDismiss()
      }
    }

    return h(ModalDrawer, { ...modalProps, children: modalBody })
  }
)
