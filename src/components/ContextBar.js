import { Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { Clickable, comingSoon } from 'src/components/common'
import { icon } from 'src/components/icons'
import { makeMenuIcon, MenuButton, MenuTrigger } from 'src/components/PopupTrigger'
import colors from 'src/libs/colors'


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
  },
  //original hover for reference
  // hover: { boxShadow: `inset -6px 0px ${colors.accent()}` }
  hover: { backgroundColor: colors.accent(0.4) }
}

export const ContextBarButtons = ({ setDeletingWorkspace, setCloningWorkspace, setSharingWorkspace, isOwner, canShare }) => {
  return div({ style: contextBarStyles.contextBarContainer }, [
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
        hover: contextBarStyles.hover,
        tooltip: 'Menu',
        tooltipDelay: 100
      }, [icon('ellipsis-v', { size: 24 })])
    ]),
    h(Clickable, {
      style: contextBarStyles.contextBarButton,
      hover: contextBarStyles.hover,
      // TODO: add click handler
      ...{ tooltip: 'Compute Configuration', tooltipDelay: 100 },
      'aria-label': 'Compute Configuration'
    }, [icon('cloudBolt', { size: 24 })]),
    h(Clickable, {
      style: contextBarStyles.contextBarButton,
      hover: contextBarStyles.hover,
      // TODO: add click handler
      tooltip: 'Terminal',
      tooltipDelay: 100,
      'aria-label': 'Terminal'
    }, [icon('terminal', { size: 24 })])
  ])
}
