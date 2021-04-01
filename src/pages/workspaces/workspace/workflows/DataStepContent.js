import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Fragment, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { ButtonPrimary, IdContainer, RadioButton } from 'src/components/common'
import DataTable from 'src/components/data/DataTable'
import { ValidatedInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { FormLabel } from 'src/libs/forms'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import {
  chooseRows, chooseSetComponents, chooseSets, processAll, processAllAsSet, processMergedSet
} from 'src/pages/workspaces/workspace/workflows/EntitySelectionType'
import validate from 'validate.js'


const DataStepContent = ({
  entitySelectionModel, onDismiss, onSuccess,
  workspaceId, entityMetadata, rootEntityType,
  workspace: { attributes: { 'workspace-column-defaults': columnDefaults } }
}) => {
  // State
  const [type, setType] = useState(entitySelectionModel.type)
  const [selectedEntities, setSelectedEntities] = useState(entitySelectionModel.selectedEntities)
  const [newSetName, setNewSetName] = useState(entitySelectionModel.newSetName)


  // Helpers
  const makeModelResetFunction = newType => () => {
    setType(newType)
    setSelectedEntities({})
  }

  const isValidSelectionModel = () => {
    const selectionSize = _.size(selectedEntities)

    return selectionSize === 1 ||
      (type === processAll && !!newSetName) ||
      (type === chooseRows && !!newSetName && selectionSize > 1) ||
      (type === chooseSets && !!newSetName && selectionSize > 1) ||
      (type === processMergedSet && !!newSetName && selectionSize > 1) ||
      (type === chooseSetComponents && !!newSetName && selectionSize > 0) ||
      (type === processAllAsSet && !!newSetName)
  }


  // Render
  const rootEntityTypeCount = entityMetadata[rootEntityType]?.count || 0

  const isSet = _.endsWith('_set', rootEntityType)
  const typeOfSet = `${rootEntityType}_set`
  const hasSet = _.has(typeOfSet, entityMetadata)
  const hasEntityType = _.has(rootEntityType, entityMetadata)
  const baseEntityType = isSet ? rootEntityType.slice(0, -4) : rootEntityType

  const baseEntityTypeCount = entityMetadata[baseEntityType]?.count || 0

  const isProcessAll = type === processAll
  const isProcessMergedSet = type === processMergedSet
  const isChooseRows = type === chooseRows
  const isChooseSets = type === chooseSets
  const isChooseSetComponents = type === chooseSetComponents
  const isProcessAllAsSet = type === processAllAsSet

  const errors = validate({ newSetName }, {
    newSetName: {
      presence: { allowEmpty: false },
      format: {
        pattern: /^[A-Za-z0-9_\-.]*$/,
        message: 'can only contain letters, numbers, underscores, dashes, and periods'
      }
    }
  })

  return h(Modal, {
    title: 'Select Data',
    okButton: h(ButtonPrimary, {
      tooltip: Utils.cond(
        [isChooseSets && _.size(selectedEntities) > 10, () => 'Please select 10 or fewer sets'],
        [_.isEmpty(selectedEntities), () => 'Please select data']
      ),
      disabled: !!errors || !isValidSelectionModel(),
      onClick: () => onSuccess({ type, selectedEntities, newSetName })
    }, 'OK'),
    onDismiss,
    width: 'calc(100% - 2rem)'
  }, [
    div({
      style: {
        padding: '1rem 0.5rem', lineHeight: '1.5rem'
      }
    }, [
      div({ role: 'radiogroup', 'aria-label': 'Select entities' }, [isSet ?
        h(Fragment, [
          div([
            h(RadioButton, {
              text: `Create a new set from all ${baseEntityTypeCount} ${baseEntityType}s`,
              name: 'choose-set-components',
              checked: isProcessAllAsSet,
              onChange: makeModelResetFunction(processAllAsSet),
              labelStyle: { marginLeft: '0.75rem' }
            })
          ]),
          div([
            h(RadioButton, {
              text: `Create a new set from selected ${baseEntityType}s`,
              name: 'choose-set-components',
              checked: isChooseSetComponents,
              onChange: makeModelResetFunction(chooseSetComponents),
              labelStyle: { marginLeft: '0.75rem' }
            })
          ]),
          hasEntityType && div([
            h(RadioButton, {
              text: 'Choose existing sets',
              name: 'choose-set-components',
              checked: isChooseSets,
              onChange: makeModelResetFunction(chooseSets),
              labelStyle: { marginLeft: '0.75rem' }
            })
          ])
        ]) :
        h(Fragment, [
          div([
            h(RadioButton, {
              text: `Process all ${rootEntityTypeCount} rows`,
              name: 'process-rows',
              checked: isProcessAll,
              onChange: makeModelResetFunction(processAll),
              labelStyle: { marginLeft: '0.75rem' }
            })
          ]),
          div([
            h(RadioButton, {
              text: 'Choose specific rows to process',
              name: 'process-rows',
              checked: isChooseRows,
              onChange: makeModelResetFunction(chooseRows),
              labelStyle: { marginLeft: '0.75rem' }
            })
          ]),
          hasSet && div([
            h(RadioButton, {
              text: 'Choose existing sets',
              name: 'process-rows',
              checked: isProcessMergedSet,
              onChange: makeModelResetFunction(processMergedSet),
              labelStyle: { marginLeft: '0.75rem' }
            })
          ])
        ])]),
      !isProcessAll && !isProcessAllAsSet && div({
        style: {
          display: 'flex', flexDirection: 'column',
          height: 500, marginTop: '1rem'
        }
      }, [
        h(DataTable, {
          key: type.description,
          childrenBefore: () => div({ style: Style.elements.sectionHeader }, [
            Utils.cond(
              [isProcessMergedSet, () => 'Select one or more sets to combine and process'],
              [isChooseRows, () => `Select ${rootEntityType}s to process`],
              [isChooseSetComponents, () => `Select ${baseEntityType}s to create a new set to process`],
              [isChooseSets, () => `Select ${rootEntityType}s to process`]
            )
          ]),
          entityType: (isChooseSetComponents && baseEntityType) || (isProcessMergedSet && typeOfSet) || rootEntityType,
          entityMetadata, workspaceId, columnDefaults,
          selectionModel: {
            selected: selectedEntities, setSelected: setSelectedEntities
          }
        })
      ]),
      (isProcessAll || isProcessAllAsSet || (isChooseSetComponents && !_.isEmpty(selectedEntities)) ||
        ((isChooseRows || isProcessMergedSet || isChooseSets) && _.size(selectedEntities) > 1)) && h(IdContainer, [
        id => div({ style: { marginTop: '1rem' } }, [
          h(FormLabel, { htmlFor: id }, [
            Utils.cond(
              [isProcessAll, () => `All ${rootEntityTypeCount} ${rootEntityType}s will be saved as a new set named:`],
              [isProcessAllAsSet, () => `All ${baseEntityTypeCount} ${baseEntityType}s will be saved as a new set named:`],
              [isProcessMergedSet, () => `Selected ${rootEntityType}s will have their membership combined into a new set named:`],
              [isChooseSetComponents, () => `Selected ${baseEntityType}s will be saved as a new set named:`],
              [isChooseSets, () => `Selected ${rootEntityType}s will be saved as a new set named:`],
              [isChooseRows, () => `Selected ${rootEntityType}s will be saved as a new set named:`]
            )
          ]),
          h(ValidatedInput, {
            inputProps: {
              id, value: newSetName, style: { marginLeft: '0.25rem' },
              onChange: setNewSetName
            },
            width: 500,
            error: Utils.summarizeErrors(errors && errors.newSetName)
          })
        ])
      ])
    ])
  ])
}

DataStepContent.propTypes = {
  entityMetadata: PropTypes.objectOf(PropTypes.shape({
    count: PropTypes.number.isRequired
  })).isRequired,
  entitySelectionModel: PropTypes.shape({
    newSetName: PropTypes.string.isRequired,
    selectedElements: PropTypes.array,
    type: PropTypes.oneOf([processAll, processMergedSet, chooseRows, chooseSets, chooseSetComponents, processAllAsSet])
  }),
  onDismiss: PropTypes.func,
  onSuccess: PropTypes.func,
  rootEntityType: PropTypes.string,
  workspaceId: PropTypes.object
}

export default DataStepContent
