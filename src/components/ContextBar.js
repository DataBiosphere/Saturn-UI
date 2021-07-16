import { Fragment, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { Clickable, comingSoon } from 'src/components/common'
import { icon } from 'src/components/icons'
import { tools } from 'src/components/notebook-utils'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import { Ajax } from 'src/libs/ajax'
import colors, { terraSpecial } from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import { getCurrentRuntime, getIsRuntimeBusy } from 'src/libs/runtime-utils'
import * as Style from 'src/libs/style'
import { CloudEnvironmentModal } from 'src/pages/workspaces/workspace/notebooks/modals/CloudEnvironmentModal'


const contextBarStyles = {
  contextBarContainer: {
    display: 'flex', flexWrap: 'wrap'
  },
  contextBarButton: {
    display: 'flex',
    borderBottom: `1px solid ${colors.accent()}`,
    padding: '1rem',
    color: colors.accent(),
    backgroundColor: colors.accent(0.2)
  }
}

export const ContextBar = ({ setDeletingWorkspace, setCloningWorkspace, setSharingWorkspace, isOwner, canShare, canCompute, runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps, workspace, persistentDisks, workspace: { workspace: { namespace, bucketName, name: workspaceName } } }) => {
  const [isCloudEnvOpen, setCloudEnvOpen] = useState(false)
  const currentRuntime = getCurrentRuntime(runtimes)
  const currentRuntimeTool = currentRuntime?.labels?.tool

  const terminalDisabled = !(currentRuntimeTool === tools.Jupyter.label) || getIsRuntimeBusy(currentRuntime)
  const terminalLaunchLink = Nav.getLink('workspace-application-launch', { namespace, name: workspaceName, application: 'terminal' })

  const startCurrentRuntime = () => {
    const { googleProject, runtimeName } = currentRuntime
    Ajax().Runtimes.runtime(googleProject, runtimeName).start()
  }

  return h(Fragment, [
    h(CloudEnvironmentModal, {
      isOpen: isCloudEnvOpen,
      onSuccess: () => {}, //TODO: I don't know if we want to do anything?
      onDismiss: () => setCloudEnvOpen(false),
      runtimes, apps, galaxyDataDisks, refreshRuntimes, refreshApps,
      workspace,
      canCompute,
      persistentDisks
    }),
    div({ style: Style.elements.contextBarContainer }, [
      div({ style: contextBarStyles.contextBarContainer }, [
        h(MenuTrigger, {
          closeOnClick: true,
          content: h(Fragment, [
            h(MenuButton, { onClick: () => setCloningWorkspace(true) }, [makeMenuIcon('copy'), 'Clone']),
            h(MenuButton, {
              disabled: !canShare,
              tooltip: !canShare && 'You have not been granted permission to share this workspace',
              tooltipSide: 'left',
              onClick: () => setSharingWorkspace(true)
            }, [makeMenuIcon('share'), 'Share']),
            h(MenuButton, { disabled: true }, [makeMenuIcon('export'), 'Publish', comingSoon]),
            h(MenuButton, {
              disabled: !isOwner,
              tooltip: !isOwner && 'You must be an owner of this workspace or the underlying billing project',
              tooltipSide: 'left',
              onClick: () => setDeletingWorkspace(true)
            }, [makeMenuIcon('trash'), 'Delete Workspace'])
          ]),
          side: 'bottom'
        }, [
          h(Clickable, {
            'aria-label': 'Menu',
            style: contextBarStyles.contextBarButton,
            hover: { boxShadow: `inset -6px 0px ${terraSpecial(0.9)}` },
            tooltip: 'Menu',
            tooltipDelay: 100
          }, [icon('ellipsis-v', { size: 24 })])
        ]),
        h(Clickable, {
          style: contextBarStyles.contextBarButton,
          hover: { boxShadow: `inset -6px 0px ${terraSpecial(0.9)}` },
          onClick: () => setCloudEnvOpen(!isCloudEnvOpen),
          ...{ tooltip: 'Compute Configuration', tooltipDelay: 100 },
          'aria-label': 'Compute Configuration'
        }, [icon('cloudBolt', { size: 24 })]),
        h(Clickable, {
          style: { ...contextBarStyles.contextBarButton, color: terminalDisabled ? colors.dark(0.7) : contextBarStyles.contextBarButton.color },
          hover: { boxShadow: `inset -6px 0px ${terraSpecial(0.9)}` },
          disabled: terminalDisabled,
          href: terminalLaunchLink,
          onClick: window.location.hash === terminalLaunchLink && currentRuntime?.status === 'Stopped' ? () => startCurrentRuntime() : undefined,
          tooltip: 'Terminal',
          tooltipDelay: 100,
          'aria-label': 'Terminal'
        }, [icon('terminal', { size: 24 })])
      ])
    ])
  ])
}
