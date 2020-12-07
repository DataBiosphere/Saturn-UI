import { icon } from 'src/components/icons'
import colors from 'src/libs/colors'


export const collapseStatus = status => {
  switch (status) {
    case 'Succeeded':
      return 'succeeded'
    case 'Aborting': // only on submissions not workflows
    case 'Aborted':
      return 'abort'
    case 'Failed':
      return 'failed'
    case 'Running':
      return 'running'
    default:
      return 'submitted'
  }
}

const size = 24

export const successIcon = style => icon('check', { size, style: { color: colors.success(), ...style } })
export const failedIcon = style => icon('warning-standard', { size, style: { color: colors.danger(), ...style } })
export const runningIcon = style => icon('sync', { size, style: { color: colors.dark(), ...style } })
export const submittedIcon = style => icon('clock', { size, style: { color: colors.dark(), ...style } })
export const abortIcon = style => icon('abort', { size, style: { color: colors.danger(), ...style } })

export const statusIcon = (status, style) => {
  switch (collapseStatus(status)) {
    case 'succeeded':
      return successIcon(style)
    case 'failed':
      return failedIcon(style)
    case 'running':
      return runningIcon(style)
    case 'abort':
      return abortIcon(style)
    default:
      return submittedIcon(style)
  }
}
