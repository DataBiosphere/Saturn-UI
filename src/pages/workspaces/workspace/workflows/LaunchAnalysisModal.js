import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { b, div, h, p, span, wbr } from 'react-hyperscript-helpers'
import { ButtonPrimary, CromwellVersionLink } from 'src/components/common'
import { warningBoxStyle } from 'src/components/data/data-utils'
import { icon, spinner } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { InfoBox } from 'src/components/PopupTrigger'
import { regionInfo } from 'src/components/region-common'
import { Ajax } from 'src/libs/ajax'
import { launch } from 'src/libs/analysis'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import * as Utils from 'src/libs/utils'
import { chooseBaseType, chooseRootType, chooseSetType, processSnapshotTable } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType'


const LaunchAnalysisModal = ({
  onDismiss, entityMetadata,
  workspace, workspace: { workspace: { namespace, name: workspaceName, bucketName } }, processSingle,
  entitySelectionModel: { type, selectedEntities, newSetName },
  config, config: { rootEntityType }, useCallCache, deleteIntermediateOutputFiles, useReferenceDisks,
  retryWithMoreMemory, retryMemoryFactor, onSuccess
}) => {
  const [launching, setLaunching] = useState(undefined)
  const [message, setMessage] = useState(undefined)
  const [launchError, setLaunchError] = useState(undefined)
  const [bucketLocation, setBucketLocation] = useState({})
  const signal = Utils.useCancellation()

  Utils.useOnMount(() => {
    const loadBucketLocation = withErrorReporting('Error loading bucket location', async () => {
      const { location, locationType } = await Ajax(signal).Workspaces.workspace(namespace, workspaceName).checkBucketLocation(bucketName)
      setBucketLocation({ location, locationType })
    })

    loadBucketLocation()
  })

  const doLaunch = async () => {
    try {
      const baseEntityType = rootEntityType?.slice(0, -4)
      const { selectedEntityType, selectedEntityNames } = Utils.cond(
        [processSingle, () => ({})],
        [type === chooseRootType, () => ({ selectedEntityType: rootEntityType, selectedEntityNames: _.keys(selectedEntities) })],
        [type === chooseSetType, () => {
          return _.size(selectedEntities) === 1 ?
            { selectedEntityType: `${rootEntityType}_set`, selectedEntityNames: _.keys(selectedEntities) } :
            { selectedEntityType: rootEntityType, selectedEntityNames: _.flow(_.flatMap(`attributes.${rootEntityType}s.items`), _.map('entityName'))(selectedEntities) }
        }],
        [type === chooseBaseType, () => ({ selectedEntityType: baseEntityType, selectedEntityNames: _.keys(selectedEntities) })],
        [type === processSnapshotTable, () => ({ selectedEntityType: rootEntityType })]
      )
      const { submissionId } = await launch({
        isSnapshot: type === processSnapshotTable,
        workspace, config, selectedEntityType, selectedEntityNames, newSetName, useCallCache, deleteIntermediateOutputFiles, useReferenceDisks,
        memoryRetryMultiplier: retryWithMoreMemory ? retryMemoryFactor : undefined,
        onProgress: stage => {
          setMessage({ createSet: 'Creating set...', launch: 'Launching analysis...', checkBucketAccess: 'Checking bucket access...' }[stage])
        }
      })
      onSuccess(submissionId)
    } catch (error) {
      setLaunchError(await (error instanceof Response ? error.text() : error.message))
      setMessage(undefined)
    }
  }

  const mergeSets = _.flatMap(`attributes.${rootEntityType}s.items`)
  const entityCount = Utils.cond(
    [processSingle, () => 1],
    [type === processSnapshotTable, () => entityMetadata[rootEntityType].count],
    [type === chooseRootType, () => _.size(selectedEntities)],
    [type === chooseBaseType, () => 1],
    [type === chooseSetType, () => _.flow(mergeSets, _.uniqBy('entityName'))(selectedEntities).length]
  )
  const wrappableOnPeriods = _.flow(str => str?.split(/(\.)/), _.flatMap(sub => sub === '.' ? [wbr(), '.'] : sub))
  const { location, locationType } = bucketLocation
  const { flag, regionDescription } = regionInfo(location, locationType)

  const onlyConstantInputs = _.every(i => !i || Utils.maybeParseJSON(i) !== undefined, config.inputs)
  const warnDuplicateAnalyses = onlyConstantInputs && entityCount > 1

  return h(Modal, {
    title: !launching ? 'Confirm launch' : 'Launching Analysis',
    onDismiss,
    showCancel: !launching,
    okButton: !launchError ?
      h(ButtonPrimary, {
        disabled: launching,
        onClick: () => {
          setLaunching(true)
          doLaunch()
        }
      }, ['Launch']) :
      h(ButtonPrimary, { onClick: onDismiss }, ['OK'])
  }, [
    div({ style: { margin: '1rem 0' } }, ['This analysis will be run by ', h(CromwellVersionLink), '.']),
    div(['Output files will be saved as workspace data in:']),
    div({ style: { margin: '1rem' } }, [
      location ? h(Fragment, [span({ style: { marginRight: '0.5rem' } }, [flag]),
        span({ style: { marginRight: '0.5rem' } }, [regionDescription]),
        h(InfoBox, [
          p(['Output (and intermediate) files will be written to your workspace bucket in this region.']),
          p(['Tasks within your workflow might additionally move or copy the data elsewhere. You should carefully vet the workflows you run if region requirements are a concern.']),
          p(['Note that metadata about this run will be stored in the US.'])
        ])]) : 'Loading...'
    ]),
    warnDuplicateAnalyses ? div({
      style: { ...warningBoxStyle, fontSize: 14, display: 'flex', flexDirection: 'column' }
    }, [
      div({ style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } }, [
        icon('warning-standard', { size: 19, style: { color: colors.warning(), flex: 'none', marginRight: '0.5rem' } }),
        'Duplicate Analysis Warning'
      ]),
      div({ style: { fontWeight: 'normal', marginTop: '0.5rem' } }, [
        'This will launch ',
        b([entityCount]),
        ' analyses, but all of the inputs are constant. This is likely to result in re-calculation of the same result multiple times.'
      ])
    ]) : div({ style: { margin: '1rem 0' } }, [
      'This will launch ',
      b([entityCount]),
      entityCount === 1 ? ' analysis.' : ' analyses.'
    ]),
    type === chooseSetType && entityCount !== mergeSets(selectedEntities).length && div({
      style: { fontStyle: 'italic', marginTop: '0.5rem' }
    }, ['(Duplicate entities are only processed once.)']),
    message && div({ style: { display: 'flex' } }, [
      spinner({ style: { marginRight: '0.5rem' } }),
      message
    ]),
    div({ style: { color: colors.danger(), overflowWrap: 'break-word' } }, [
      h(Fragment, wrappableOnPeriods(launchError))
    ])
  ])
}

export default LaunchAnalysisModal
