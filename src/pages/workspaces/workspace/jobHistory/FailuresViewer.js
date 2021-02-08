import _ from 'lodash/fp'
import { h } from 'react-hyperscript-helpers'
import ReactJson from 'react-json-view'


const FailuresViewer = ({ failures }) => {
  const restructureFailures = failuresArray => {
    const filtered = _.filter(({ message }) => !_.isEmpty(message) && !message.startsWith('Will not start job'), failuresArray)
    const sizeDiff = failuresArray.length - filtered.length
    const newMessage = sizeDiff > 0 ? [{
      message: `${sizeDiff} jobs were queued in Cromwell but never sent to the cloud backend due to failures elsewhere in the workflow`
    }] : []
    const simplifiedFailures = [...filtered, ...newMessage]

    return _.map(({ message, causedBy }) => ({
      message,
      ...(!_.isEmpty(causedBy) ? { causedBy: restructureFailures(causedBy) } : {})
    }), simplifiedFailures)
  }

  return h(ReactJson, {
    style: { whiteSpace: 'pre-wrap' },
    name: false,
    collapsed: 4,
    enableClipboard: false,
    displayDataTypes: false,
    displayObjectSize: false,
    src: restructureFailures(failures)
  })
}

export default FailuresViewer
