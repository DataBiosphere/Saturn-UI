import _ from 'lodash/fp'
import { Component, Fragment } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { ButtonPrimary, CromwellVersionLink } from 'src/components/common'
import { spinner } from 'src/components/icons'
import Modal from 'src/components/Modal'
import { ajaxCaller } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import EntitySelectionType from 'src/pages/workspaces/workspace/workflows/EntitySelectionType'


export default ajaxCaller(class LaunchAnalysisModal extends Component {
  constructor(props) {
    super(props)
    this.state = {
      launching: undefined, message: undefined, launchError: undefined,
      multiLaunchCompletions: undefined, multiLaunchErrors: undefined
    }
  }

  /**
   * Verify that the user's pet service account (used while running workflows) will be able to
   * access the workspace bucket
   *
   * @returns {Promise<boolean>}
   */
  async preFlightBucketAccess() {
    const { workspaceId: { namespace, name }, accessLevel, bucketName, ajax: { Workspaces } } = this.props

    try {
      await Workspaces.workspace(namespace, name).checkBucketAccess(bucketName, accessLevel)
      return true
    } catch (error) {
      // Could check error.requesterPaysError here but for this purpose it really doesn't matter what the error was.
      return false
    }
  }

  render() {
    const { onDismiss, entitySelectionModel: { type, selectedEntities } } = this.props
    const { launching, message, multiLaunchCompletions, launchError, multiLaunchErrors } = this.state
    const entityCount = _.size(selectedEntities)

    return h(Modal, {
      title: !launching ? 'Confirm launch' : 'Launching Analysis',
      onDismiss,
      showCancel: !launching,
      okButton: !(launchError || multiLaunchErrors) ?
        h(ButtonPrimary, {
          disabled: launching,
          onClick: () => {
            this.setState({ launching: true })
            this.doLaunch()
          }
        }, ['Launch']) :
        h(ButtonPrimary, { onClick: onDismiss }, ['OK'])
    }, [
      div({ style: { margin: '1rem 0' } }, ['This analysis will be run by ', h(CromwellVersionLink), '.']),
      type === EntitySelectionType.chooseSets && entityCount > 1 && div({ style: { margin: '1rem 0' } }, [
        `This will launch ${entityCount} analyses simultaneously.`
      ]),
      (message || multiLaunchCompletions !== undefined) && div({ style: { display: 'flex' } }, [
        spinner({ style: { marginRight: '0.5rem' } }),
        message,
        multiLaunchCompletions !== undefined && div({
          style: { flexGrow: 1, backgroundColor: colors.secondary(0.3), borderRadius: 5, height: 24 }
        }, [div({
          style: {
            backgroundColor: colors.accent(),
            height: '100%', width: `${multiLaunchCompletions / entityCount * 100}%`,
            borderRadius: 5
          }
        })])
      ]),
      launchError && div({ style: { color: colors.danger() } }, [launchError]),
      multiLaunchErrors && h(Fragment, _.map(({ name, message }) => div({
        style: { color: colors.danger(), marginTop: '1rem' }
      }, [`Error launching with set ${name}: `, message]),
      multiLaunchErrors))
    ])
  }

  async doLaunch() {
    const {
      workspaceId: { namespace, name },
      processSingle, entitySelectionModel: { type, selectedEntities },
      config: { rootEntityType },
      ajax: { Workspaces }
    } = this.props

    this.setState({ message: 'Checking bucket access...' })
    const hasBucketAccess = await this.preFlightBucketAccess()
    if (!hasBucketAccess) {
      this.setState({
        message: undefined,
        launchError: 'Error confirming workspace bucket access. This may be a transient problem. Please try again in a few minutes. If the problem persists, please contact support.'
      })
    } else if (processSingle) {
      this.launch()
    } else if (type === EntitySelectionType.processAll) {
      this.setState({ message: 'Fetching data...' })
      const entities = _.map('name', await Workspaces.workspace(namespace, name).entitiesOfType(rootEntityType))
      this.createSetAndLaunch(entities)
    } else if (type === EntitySelectionType.chooseRows) {
      const entities = _.keys(selectedEntities)
      if (_.size(entities) === 1) {
        this.launch(rootEntityType, _.head(entities))
      } else {
        this.createSetAndLaunch(entities)
      }
    } else if (type === EntitySelectionType.processMergedSet) {
      if (_.size(selectedEntities) === 1) {
        const { entityType, name } = selectedEntities[0]
        this.launch(entityType, name, `this.${rootEntityType}s`)
      } else {
        const entities = _.flow(
          _.flatMap(`attributes.${rootEntityType}s.items`),
          _.map('entityName')
        )(selectedEntities)

        this.createSetAndLaunch(entities)
      }
    } else if (type === EntitySelectionType.chooseSets) {
      if (_.size(selectedEntities) === 1) {
        this.launch(rootEntityType, _.values(selectedEntities)[0].name)
      } else {
        this.launchParallel()
      }
    }
  }

  async createSetAndLaunch(entities) {
    const {
      workspaceId: { namespace, name },
      entitySelectionModel: { newSetName },
      config: { rootEntityType },
      ajax: { Workspaces }
    } = this.props

    const setType = `${rootEntityType}_set`

    this.setState({ message: 'Creating data set...' })
    const newSet = {
      name: newSetName,
      entityType: setType,
      attributes: {
        [`${rootEntityType}s`]: {
          itemsType: 'EntityReference',
          items: _.map(entityName => ({ entityName, entityType: rootEntityType }), entities)
        }
      }
    }

    try {
      await Workspaces.workspace(namespace, name).createEntity(newSet)
    } catch (error) {
      this.setState({ launchError: await error.text(), message: undefined })
      return
    }

    await this.launch(setType, newSetName, `this.${rootEntityType}s`)
  }

  baseLaunch(entityType, entityName, expression) {
    const {
      workspaceId: { namespace, name },
      config: { namespace: configNamespace, name: configName },
      useCallCache,
      ajax: { Workspaces }
    } = this.props

    return Workspaces.workspace(namespace, name).methodConfig(configNamespace, configName).launch({
      entityType, entityName, expression, useCallCache
    })
  }

  async launch(entityType, entityName, expression) {
    const { onSuccess } = this.props

    try {
      this.setState({ message: 'Launching analysis...' })

      const { submissionId } = await this.baseLaunch(entityType, entityName, expression)
      onSuccess(submissionId)
    } catch (error) {
      this.setState({ launchError: JSON.parse(await error.text()).message, message: undefined })
    }
  }

  async launchParallel() {
    const { onSuccessMulti, entitySelectionModel: { selectedEntities }, config: { rootEntityType } } = this.props

    this.setState({ multiLaunchCompletions: 0, message: undefined })

    const allErrors = await Promise.all(_.map(async ({ name }) => {
      try {
        await this.baseLaunch(rootEntityType, name)
      } catch (error) {
        const { message } = JSON.parse(await error.text())
        return { name, message }
      } finally {
        this.setState(_.update('multiLaunchCompletions', _.add(1)))
      }
    }, selectedEntities))

    const multiLaunchErrors = _.compact(allErrors)

    if (_.isEmpty(multiLaunchErrors)) {
      onSuccessMulti()
    } else if (multiLaunchErrors.length === _.size(selectedEntities)) {
      this.setState({ multiLaunchErrors, multiLaunchCompletions: undefined })
    } else {
      reportError(`${multiLaunchErrors.length} sets failed to launch`, {
        message: h(Fragment, _.map(({ name, message }) => div([`Error launching with set ${name}: ${message}`]), multiLaunchErrors))
      })
      onSuccessMulti()
    }
  }
})
