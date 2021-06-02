import _ from 'lodash/fp'
import { Chart } from 'react-google-charts'
import { div, h } from 'react-hyperscript-helpers'


export const WorkflowTimingDiagram = ({ callNames: sortedCallNames, callData }) => {
  const timingData = _.map(callName => {
    const callArray = callData[callName]
    const now = Date.now()

    const firstStartTime = _.flow(
      _.map(c => c.start ? new Date(c.start) : (c.end ? new Date(c.end) - 1 : now - 1)),
      _.minBy(_.identity)
    )(callArray)

    const finished = _.every(c => c.end, callArray)

    const lastEndTime = finished ? _.flow(
      _.map(c => new Date(c.end)),
      _.maxBy(_.identity)
    )(callArray) : now

    return [callName, `${callName.replace(/.*\./, '')} × ${_.size(callData[callName])}`, firstStartTime, lastEndTime]
  }, sortedCallNames)

  const timingColors = _.map(callName => {
    const statusCodes = {
      Done: 'b',
      RetryableFailure: 'b',
      Running: 'c',
      Aborting: 'd',
      Aborted: 'd',
      Failed: 'e'
    }
    const unknownCode = 'x'
    const statusColors = {
      a: 'rgb(204, 204, 255)',
      b: 'rgb(116, 174, 67)',
      c: 'rgb(0, 0, 153)',
      d: 'rgb(236,156,88)',
      e: 'rgb(204, 51, 0)',
      x: 'rgb(204, 204, 255)'
    }


    let highestCode = 'a'
    for (let i = 0; i < _.size(callData[callName]); i++) {
      const thisStatus = callData[callName][i].executionStatus
      const thisCode = _.getOr(unknownCode, thisStatus, statusCodes)
      if (thisCode > highestCode) { highestCode = thisCode }
    }

    return statusColors[highestCode]
  }, sortedCallNames)

  return div({ style: { display: 'flex', width: '100%' } }, [
    h(Chart, {
      width: '100%',
      height: (1 + _.min([_.size(callData), 10])) * 50,
      chartType: 'Timeline',
      loader: 'Loading Chart',
      data: [
        [
          { type: 'string', id: 'CallName' },
          { type: 'string', id: 'Label' },
          { type: 'date', id: 'Start' },
          { type: 'date', id: 'End' }
        ],
        ...timingData
      ],
      options: {
        timeline: {
          showRowLabels: false,
          barLabelStyle: {
            fontName: 'Courier New',
            fontSize: 14
          }
        },
        colors: timingColors
      }
    })
  ])
}
