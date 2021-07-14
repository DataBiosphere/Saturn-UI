import { differenceInCalendarDays, parseJSON } from 'date-fns/fp'
import _ from 'lodash/fp'
import { useEffect, useState } from 'react'
import { div, h, input, span } from 'react-hyperscript-helpers'
import { ButtonSecondary, Clickable } from 'src/components/common'
import { icon } from 'src/components/icons'
import { TextArea } from 'src/components/input'
import Interactive from 'src/components/Interactive'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { getAppName } from 'src/libs/logos'
import { authStore } from 'src/libs/state'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


const styles = {
  questionLabel: { fontWeight: 600, marginBottom: '0.5rem' },
  questionInput: { marginBottom: '0.75rem', height: '4rem', marginTop: '0.25rem' }
}

const NpsSurvey = () => {
  const [requestable, setRequestable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [score, setScore] = useState()
  const [reasonComment, setReasonComment] = useState('')
  const [changeComment, setChangeComment] = useState('')

  const { registrationStatus } = Utils.useStore(authStore)

  const loadStatus = async () => {
    const lastResponseTimestamp = (await Ajax().User.lastNpsResponse()).timestamp

    // Behavior of the following logic: When a user first accesses Terra, wait 7 days to show the NPS survey.
    // Once user has interacted with the NPS survey, wait 90 days to show the survey.
    const askTheUser = !!lastResponseTimestamp ?
      differenceInCalendarDays(parseJSON(lastResponseTimestamp), Date.now()) >= 90 :
      differenceInCalendarDays(parseJSON((await Ajax().User.firstTimestamp()).timestamp), Date.now()) >= 7

    setRequestable(askTheUser)
  }

  useEffect(() => {
    if (registrationStatus === 'registered') {
      loadStatus()
    } else {
      setRequestable(false)
    }
  }, [registrationStatus])

  const goAway = shouldSubmit => () => {
    setRequestable(false)
    Ajax().User.postNpsResponse(shouldSubmit ? { score, reasonComment, changeComment } : {})
  }

  const scoreRadios = _.map(i => {
    const isSelected = i === score
    const bgColor = Utils.cond(
      [i <= 6, () => colors.danger(0.5)],
      [i <= 8, () => colors.warning(0.8)],
      () => colors.success(0.8)
    )

    return h(Interactive, {
      as: 'label',
      style: {
        width: 25, borderRadius: '1rem',
        lineHeight: '25px', textAlign: 'center',
        cursor: 'pointer',
        ...(isSelected ? { backgroundColor: bgColor, color: colors.dark() } : {})
      },
      hover: isSelected ? {} : { backgroundColor: colors.dark(0.7) }
    }, [
      input({
        type: 'radio', value: i, name: 'nps-score',
        checked: isSelected,
        onChange: () => setScore(i),
        style: { display: 'none' }
      }),
      i
    ])
  },
  _.range(0, 11))

  return requestable && div({
    className: 'animate__animated animate__fadeIn',
    style: {
      position: 'fixed', bottom: '1.5rem', right: expanded ? '1.5rem' : 0,
      transition: 'right 0.2s linear',
      zIndex: 1
    }
  }, [
    h(Clickable, {
      onClick: () => setExpanded(true),
      disabled: expanded,
      style: {
        display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly',
        height: expanded ? 345 : 120,
        width: expanded ? 405 : 255,
        padding: '1rem 1.5rem 1rem 1rem',
        overflow: 'hidden',
        backgroundColor: colors.dark(), color: 'white',
        borderRadius: expanded ? '0.5rem' : '0.5rem 0 0 0.5rem',
        transition: 'all 0.25s linear',
        boxShadow: Style.standardShadow
      }
    },
    !expanded ? [
      div({ style: styles.questionLabel }, `How likely are you to recommend ${getAppName()} to others?`),
      div({ style: { display: 'flex', justifyContent: 'space-around', marginBottom: '0.5rem' } }, scoreRadios)
    ] : [
      div({ style: styles.questionLabel }, `How likely are you to recommend ${getAppName()} to others?`),
      div({ style: { display: 'flex', justifyContent: 'space-around', marginBottom: '0.5rem' } }, scoreRadios),
      div({ style: styles.questionLabel }, ['What was the reason for this score? ',
        span({ style: { ...styles.questionLabel, fontStyle: 'italic' } }, '(Optional)')]),
      h(TextArea, { style: styles.questionInput, value: reasonComment, onChange: setReasonComment }),
      div({ style: styles.questionLabel }, ['What could we change? ',
        span({ style: { ...styles.questionLabel, fontStyle: 'italic' } }, '(Optional)')]),
      h(TextArea, { style: styles.questionInput, value: changeComment, onChange: setChangeComment }),
      div({ style: { display: 'flex', justifyContent: 'flex-end' } }, [
        h(ButtonSecondary, {
          style: { color: 'white' },
          hover: { color: colors.dark(0.25) },
          onClick: goAway(true)
        }, 'Submit')
      ])
    ]),
    h(Clickable, { onClick: goAway(false) }, [
      icon('times-circle', {
        size: 20,
        style: {
          position: 'absolute', top: -5, left: -5,
          backgroundColor: 'black',
          color: 'white',
          borderRadius: '1rem'
        }
      })
    ])
  ])
}

export default NpsSurvey
