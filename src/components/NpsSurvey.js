import _ from 'lodash/fp'
import { Component } from 'react'
import { div, h, input } from 'react-hyperscript-helpers'
import Interactive from 'react-interactive'
import { buttonSecondary, Clickable } from 'src/components/common'
import { icon } from 'src/components/icons'
import { TextArea } from 'src/components/input'
import { Ajax } from 'src/libs/ajax'
import { authStore } from 'src/libs/auth'
import colors from 'src/libs/colors'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


export const responseRequested = Utils.atom(false)

const styles = {
  questionLabel: { fontWeight: 600, marginBottom: '0.5rem' },
  questionInput: { marginBottom: '0.75rem', height: '4rem' }
}

export const NpsSurvey = _.flow(
  Utils.connectAtom(responseRequested, 'responseRequested'),
  Utils.connectAtom(authStore, 'authState')
)(class NpsSurvey extends Component {
  constructor(props) {
    super(props)

    this.state = { requestable: false, expanded: false }
  }

  componentDidMount() {
    const { authState: { registrationStatus } } = this.props

    if (registrationStatus === 'registered') {
      this.loadStatus()
    }
  }

  componentDidUpdate(prevProps) {
    const { authState: { registrationStatus } } = this.props

    if (registrationStatus === 'registered' && prevProps.authState.registrationStatus !== 'registered') {
      this.loadStatus()
    }
  }

  async loadStatus() {
    const lastResponse = (await Ajax().User.lastNpsResponse()).timestamp
    const oneMonthAgo = _.tap(d => d.setDate(d.getMonth() - 1), new Date())

    this.setState({ requestable: !lastResponse || (new Date(lastResponse) < oneMonthAgo) })
  }

  render() {
    const { responseRequested } = this.props
    const { requestable, expanded, score, reasonComment, changeComment } = this.state
    const shouldShow = responseRequested && requestable
    const goAway = shouldSubmit => () => {
      this.setState({ requestable: false })
      Ajax().User.postNpsResponse(shouldSubmit ? { score, reasonComment, changeComment } : {})
    }

    const scoreRadios = _.map(i => {
      const isSelected = i === score
      const bgColor = Utils.cond(
        [i <= 6, colors.brick],
        [i <= 8, colors.orange[0]],
        colors.blue[0]
      )

      return h(Interactive, {
        as: 'label',
        style: {
          width: 25, borderRadius: '1rem',
          lineHeight: '25px', textAlign: 'center',
          cursor: 'pointer',
          ...(isSelected ? { backgroundColor: bgColor } : {})
        },
        hover: isSelected ? {} : { backgroundColor: colors.gray[2] }
      }, [
        input({
          type: 'radio', value: i, name: 'nps-score',
          checked: isSelected,
          onChange: () => this.setState({ score: i }),
          style: { display: 'none' }
        }),
        i
      ])
    },
    _.range(0, 11))

    return requestable && div({
      style: {
        position: 'fixed', bottom: '1.5rem', right: expanded ? '1.5rem' : 0,
        transform: `translate(${shouldShow ? '0%' : 'calc(100% + 5px)'})`,
        transition: 'right 0.2s linear, transform 0.3s linear',
        zIndex: 1
      }
    }, [
      h(Clickable, {
        onClick: () => this.setState({ expanded: true }),
        disabled: expanded,
        style: {
          height: expanded ? 350 : 50,
          width: expanded ? 300 : 175,
          padding: '1rem',
          overflow: 'hidden',
          backgroundColor: colors.darkBlue[0], color: 'white',
          borderRadius: expanded ? '0.5rem' : '0.5rem 0 0 0.5rem',
          transition: 'all 0.25s linear',
          boxShadow: Style.standardShadow
        }
      },
      !expanded ?
        'How are we doing?' :
        [
          div({ style: styles.questionLabel }, 'How likely are you to recommend Terra to others?'),
          div({ style: { display: 'flex', justifyContent: 'space-around', marginBottom: '0.5rem' } }, scoreRadios),
          div({ style: styles.questionLabel }, 'What was the reason for this score?'),
          TextArea({ style: styles.questionInput, value: reasonComment, onChange: e => this.setState({ reasonComment: e.target.value }) }),
          div({ style: styles.questionLabel }, 'What could we change?'),
          TextArea({ style: styles.questionInput, value: changeComment, onChange: e => this.setState({ changeComment: e.target.value }) }),
          div({ style: { display: 'flex', justifyContent: 'flex-end' } }, [
            buttonSecondary({
              style: { color: 'white' },
              hover: { color: colors.gray[5] },
              onClick: goAway(true)
            }, 'Submit')
          ])
        ]
      ),
      h(Clickable, {
        as: icon('times-circle'),
        onClick: goAway(false),
        size: 20,
        style: {
          position: 'absolute', top: -5, left: -5,
          backgroundColor: 'black',
          color: 'white',
          borderRadius: '1rem'
        }
      })
    ])
  }
})
