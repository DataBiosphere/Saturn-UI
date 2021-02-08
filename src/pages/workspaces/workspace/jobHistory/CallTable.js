import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { Link } from 'src/components/common'
import { icon } from 'src/components/icons'
import { makeCromwellStatusLine } from 'src/components/job-common'
import { FlexTable, TooltipCell } from 'src/components/table'
import colors from 'src/libs/colors'
import * as Nav from 'src/libs/nav'
import CallCacheWizard from 'src/pages/workspaces/workspace/jobHistory/CallCacheWizard'
import FailuresViewer from 'src/pages/workspaces/workspace/jobHistory/FailuresViewer'


const CallTable = ({ namespace, name, submissionId, workflowId, callName, callObjects }) => {
  const [wizardSelection, setWizardSelection] = useState()

  return div([
    h(FlexTable, {
      height: _.min([callObjects.length * 100, 600]),
      width: _.max([window.screen.width - 200, 0]),
      rowCount: callObjects.length,
      noContentMessage: 'No matching workflows',
      columns: [
        {
          size: { basis: 200, grow: 0 },
          headerRenderer: () => 'Status',
          cellRenderer: ({ rowIndex }) => {
            const { executionStatus } = callObjects[rowIndex]
            return h(TooltipCell, [makeCromwellStatusLine(executionStatus)])
          }
        }, {
          size: { basis: 100, grow: 0 },
          headerRenderer: () => 'Index',
          cellRenderer: ({ rowIndex }) => {
            const { shardIndex } = callObjects[rowIndex]
            return h(TooltipCell, [shardIndex >= 0 ? shardIndex : 'N/A'])
          }
        }, {
          size: { basis: 100, grow: 0 },
          headerRenderer: () => 'Attempt',
          cellRenderer: ({ rowIndex }) => {
            const { attempt } = callObjects[rowIndex]
            return h(TooltipCell, [attempt])
          }
        },
        {
          size: { basis: 200, grow: 1 },
          headerRenderer: () => 'Call Caching Result',
          cellRenderer: ({ rowIndex }) => {
            const { callCaching: { result } = {}, shardIndex, attempt } = callObjects[rowIndex]
            if (result) {
              return h(Fragment, [
                h(TooltipCell, [result]),
                result === 'Cache Miss' && h(Link, {
                  style: { marginLeft: '0.5rem' },
                  tooltip: 'Cache Miss Debug Wizard',
                  onClick: () => setWizardSelection({ callFqn: callName, index: shardIndex, attempt })
                }, [icon('magic', { size: 18 })])
              ])
            } else {
              return div({ style: { color: colors.dark(0.7) } }, ['No Information'])
            }
          }
        },
        {
          size: { basis: 100, grow: 1 },
          headerRenderer: () => 'Failures',
          cellRenderer: ({ rowIndex }) => {
            const { failures } = callObjects[rowIndex]
            if (failures) {
              return h(FailuresViewer, { failures })
            } else {
              return div({ style: { color: colors.dark(0.7) } }, ['N/A'])
            }
          }
        },
        {
          size: { basis: 150, grow: 0 },
          headerRenderer: () => 'Links',
          cellRenderer: ({ rowIndex }) => {
            const { shardIndex, attempt } = callObjects[rowIndex]
            return h(Link, {
              href: Nav.getLink('workspace-call-details', { namespace, name, submissionId, workflowId, callFqn: callName, index: shardIndex, attempt }),
              style: { display: 'flex', alignItems: 'center' }
            }, [icon('code-branch', { size: 18, marginRight: '0.5rem' }), ' Call Details'])
          }
        }
      ]
    }),
    wizardSelection && h(CallCacheWizard, {
      onDismiss: () => setWizardSelection(undefined),
      namespace, name, submissionId, workflowId, ...wizardSelection
    })
  ])
}

export default CallTable
