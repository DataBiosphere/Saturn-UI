import _ from 'lodash/fp'
import { Component } from 'src/libs/wrapped-components'
import { div, h } from 'react-hyperscript-helpers'
import Modal from 'src/components/Modal'
import { buttonPrimary, LabeledCheckbox, Clickable } from 'src/components/common'
import * as Utils from 'src/libs/utils'
import { AutoSizer, List } from 'react-virtualized'

const styles = {
  columnName: {
    paddingLeft: '0.25rem',
    flex: 1, display: 'flex', alignItems: 'center',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  }
}

const getStrings = v => {
  return Utils.cond(
    [_.isString(v), () => [v]],
    [v.items, () => _.map(getStrings, v.items)],
    () => []
  )
}

export class IGVFileSelector extends Component {
  constructor(props) {
    super(props)
    this.state = { selectedFiles: _.fromPairs(_.map(v => [v, true], this.getIGVFileList())) }
  }

  toggleVisibility(name) {
    this.setState(_.update(['selectedFiles', name], b => !b))
  }

  getIGVFileList() {
    const { selectedEntities } = this.props
    return _.flow(
      _.flatMap(row => _.flatMap(getStrings, row.attributes)),
      _.uniq,
      _.filter(v => /\.(cram|bam|bed|vcf)$/.test(v))
    )(selectedEntities)
  }

  render() {
    const { onDismiss, onSuccess } = this.props
    const { selectedFiles } = this.state
    const trackFiles = this.getIGVFileList()
    return h(Modal, {
      onDismiss,
      title: 'Open files with IGV',
      okButton: buttonPrimary({
        disabled: !_.some(_.identity, selectedFiles),
        onClick: () => {
          const actuallySelectedFiles = _.flow(
            _.keys,
            _.filter(v => selectedFiles[v])
          )(selectedFiles)
          onSuccess(actuallySelectedFiles)
        }
      }, ['Done'])
    }, [
      h(AutoSizer, { disableHeight: true }, [
        ({ width }) => {
          return h(List, {
            width, height: 400,
            rowCount: trackFiles.length,
            rowHeight: 30,
            noRowsRenderer: () => 'No valid files found',
            rowRenderer: ({ index, style, key }) => {
              const name = trackFiles[index]
              return div({ key, index, style: { ...style, display: 'flex' } }, [
                div({ style: { display: 'flex', alignItems: 'center' } }, [
                  h(LabeledCheckbox, {
                    checked: selectedFiles[name],
                    onChange: () => this.toggleVisibility(name)
                  })
                ]),
                h(Clickable, {
                  style: styles.columnName,
                  title: name,
                  onClick: () => this.toggleVisibility(name)
                }, [name])
              ])
            }
          })
        }
      ])
    ])
  }
}
