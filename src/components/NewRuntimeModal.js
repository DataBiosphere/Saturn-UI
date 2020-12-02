import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Component, Fragment } from 'react'
import { b, br, code, div, fieldset, h, input, label, legend, li, p, span, ul } from 'react-hyperscript-helpers'
import { ButtonOutline, ButtonPrimary, ButtonSecondary, GroupedSelect, IdContainer, Link, Select, spinnerOverlay, WarningTitle } from 'src/components/common'
import { icon } from 'src/components/icons'
import { ImageDepViewer } from 'src/components/ImageDepViewer'
import { NumberInput, TextInput, ValidatedInput } from 'src/components/input'
import { withModalDrawer } from 'src/components/ModalDrawer'
import { InfoBox } from 'src/components/PopupTrigger'
import { SaveFilesHelp } from 'src/components/runtime-common'
import TitleBar from 'src/components/TitleBar'
import { cloudServices, machineTypes } from 'src/data/machines'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import { currentRuntime, DEFAULT_DISK_SIZE, findMachineType, persistentDiskCostMonthly, runtimeConfigBaseCost, runtimeConfigCost } from 'src/libs/runtime-utils'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


// Change to true to enable a debugging panel (intended for dev mode only)
const showDebugPanel = false

const styles = {
  label: { fontWeight: 600, whiteSpace: 'pre' },
  titleBar: { marginBottom: '1rem' },
  drawerContent: { display: 'flex', flexDirection: 'column', flex: 1, padding: '1.5rem' },
  warningView: { backgroundColor: colors.warning(0.1) },
  whiteBoxContainer: { padding: '1rem', borderRadius: 3, backgroundColor: 'white' }
}

const terraDockerBaseGithubUrl = 'https://github.com/databiosphere/terra-docker'
const terraBaseImages = `${terraDockerBaseGithubUrl}#terra-base-images`
const safeImageDocumentation = 'https://support.terra.bio/hc/en-us/articles/360034669811'

// distilled from https://github.com/docker/distribution/blob/95daa793b83a21656fe6c13e6d5cf1c3999108c7/reference/regexp.go
const imageValidationRegexp = /^[A-Za-z0-9]+[\w./-]+(?::\w[\w.-]+)?(?:@[\w+.-]+:[A-Fa-f0-9]{32,})?$/

const validMachineTypes = _.filter(({ memory }) => memory >= 4, machineTypes)

const MachineSelector = ({ value, onChange }) => {
  const { cpu: currentCpu, memory: currentMemory } = findMachineType(value)
  return h(Fragment, [
    h(IdContainer, [
      id => h(Fragment, [
        label({ htmlFor: id, style: styles.label }, ['CPUs']),
        div([
          h(Select, {
            id,
            isSearchable: false,
            value: currentCpu,
            onChange: option => onChange(_.find({ cpu: option.value }, validMachineTypes)?.name || value),
            options: _.flow(_.map('cpu'), _.union([currentCpu]), _.sortBy(_.identity))(validMachineTypes)
          })
        ])
      ])
    ]),
    h(IdContainer, [
      id => h(Fragment, [
        label({ htmlFor: id, style: styles.label }, ['Memory (GB)']),
        div([
          h(Select, {
            id,
            isSearchable: false,
            value: currentMemory,
            onChange: option => onChange(_.find({ cpu: currentCpu, memory: option.value }, validMachineTypes)?.name || value),
            options: _.flow(_.filter({ cpu: currentCpu }), _.map('memory'), _.union([currentMemory]), _.sortBy(_.identity))(validMachineTypes)
          })
        ])
      ])
    ])
  ])
}

const DiskSelector = ({ value, onChange }) => {
  return h(IdContainer, [
    id => h(Fragment, [
      label({ htmlFor: id, style: styles.label }, ['Disk size (GB)']),
      h(NumberInput, {
        id,
        min: 10,
        max: 64000,
        isClearable: false,
        onlyInteger: true,
        value,
        onChange
      })
    ])
  ])
}

const RadioBlock = ({ labelText, children, name, checked, onChange, style = {} }) => {
  return div({
    style: {
      backgroundColor: colors.warning(.2),
      borderRadius: 3, border: `1px solid ${checked ? colors.accent() : 'transparent'}`,
      boxShadow: checked ? Style.standardShadow : undefined,
      display: 'flex', alignItems: 'baseline', padding: '.75rem',
      ...style
    }
  }, [
    h(IdContainer, [id => h(Fragment, [
      input({ type: 'radio', name, checked, onChange, id }),
      div({ style: { marginLeft: '.75rem' } }, [
        label({ style: { fontWeight: 600, fontSize: 16 }, htmlFor: id }, [labelText]),
        children
      ])
    ])])
  ])
}

const CUSTOM_MODE = '__custom_mode__'

export const NewRuntimeModal = withModalDrawer({ width: 675 })(class NewRuntimeModal extends Component {
  static propTypes = {
    runtimes: PropTypes.array,
    persistentDisks: PropTypes.array,
    namespace: PropTypes.string.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
  }

  constructor(props) {
    super(props)
    const currentRuntime = this.getCurrentRuntime()
    const currentPersistentDisk = this.getCurrentPersistentDisk()

    this.state = {
      loading: false,
      currentRuntimeDetails: currentRuntime,
      currentPersistentDiskDetails: currentPersistentDisk,
      ...this.getInitialState(currentRuntime, currentPersistentDisk),
      jupyterUserScriptUri: '', customEnvImage: '',
      viewMode: undefined,
      deleteDiskSelected: false,
      upgradeDiskSelected: false,
      simplifiedForm: !currentRuntime
    }
  }

  getInitialState(runtime, disk) {
    const runtimeConfig = runtime?.runtimeConfig
    return {
      selectedPersistentDiskSize: disk?.size || DEFAULT_DISK_SIZE,
      sparkMode: runtimeConfig?.cloudService === cloudServices.DATAPROC ? (runtimeConfig.numberOfWorkers === 0 ? 'master' : 'cluster') : false,
      masterMachineType: runtimeConfig?.masterMachineType || runtimeConfig?.machineType || 'n1-standard-4',
      masterDiskSize: runtimeConfig?.masterDiskSize || runtimeConfig?.diskSize || DEFAULT_DISK_SIZE,
      numberOfWorkers: runtimeConfig?.numberOfWorkers || 2,
      numberOfPreemptibleWorkers: runtimeConfig?.numberOfPreemptibleWorkers || 0,
      workerMachineType: runtimeConfig?.workerMachineType || 'n1-standard-4',
      workerDiskSize: runtimeConfig?.workerDiskSize || DEFAULT_DISK_SIZE
    }
  }

  makeWorkspaceObj() {
    const { namespace, name } = this.props
    return { workspace: { namespace, name } }
  }

  getCurrentRuntime() {
    const { runtimes } = this.props
    return currentRuntime(runtimes)
  }

  getCurrentPersistentDisk() {
    const currentRuntime = this.getCurrentRuntime()
    const { runtimes, persistentDisks } = this.props
    const id = currentRuntime?.runtimeConfig.persistentDiskId
    const attachedIds = _.without([undefined], _.map(runtime => runtime.runtimeConfig.persistentDiskId, runtimes))
    return id ?
      _.find({ id }, persistentDisks) :
      _.last(_.sortBy('auditInfo.createdDate', _.filter(({ id, status }) => status !== 'Deleting' && !_.includes(id, attachedIds), persistentDisks)))
  }

  /**
   * Transforms the new environment config into the shape of runtime config
   * returned from leonardo. The cost calculation functions expect that shape,
   * so this is necessary to compute the cost for potential new configurations.
   */
  getPendingRuntimeConfig() {
    const { runtime: newRuntime } = this.getNewEnvironmentConfig()
    return {
      cloudService: newRuntime.cloudService,
      ...(newRuntime.cloudService === cloudServices.GCE ? {
        bootDiskSize: 50,
        machineType: newRuntime.machineType,
        ...(newRuntime.diskSize ? {
          diskSize: newRuntime.diskSize
        } : {})
      } : {
        masterMachineType: newRuntime.masterMachineType,
        masterDiskSize: newRuntime.masterDiskSize,
        numberOfWorkers: newRuntime.numberOfWorkers,
        ...(newRuntime.numberOfWorkers && {
          numberOfPreemptibleWorkers: newRuntime.numberOfPreemptibleWorkers,
          workerMachineType: newRuntime.workerMachineType,
          workerDiskSize: newRuntime.workerDiskSize
        })
      })
    }
  }

  /**
   * Transforms the new environment config into the shape of a disk returned
   * from leonardo. The cost calculation functions expect that shape, so this
   * is necessary to compute the cost for potential new disk configurations.
   */
  getPendingDisk() {
    const { persistentDisk: newPersistentDisk } = this.getNewEnvironmentConfig()
    return { size: newPersistentDisk.size, status: 'Ready' }
  }

  sendCloudEnvironmentMetrics() {
    const { runtime: newRuntime, persistentDisk: newPersistentDisk } = this.getNewEnvironmentConfig()
    const { runtime: oldRuntime, persistentDisk: oldPersistentDisk } = this.getOldEnvironmentConfig()
    const newMachineType = newRuntime && (newRuntime.cloudService === cloudServices.GCE ? newRuntime.machineType : newRuntime.masterMachineType)
    const oldMachineType = oldRuntime && (oldRuntime?.cloudService === cloudServices.GCE ? oldRuntime.machineType : oldRuntime.masterMachineType)
    const { cpu: newRuntimeCpus, memory: newRuntimeMemory } = findMachineType(newMachineType)
    const { cpu: oldRuntimeCpus, memory: oldRuntimeMemory } = findMachineType(oldMachineType)
    const metricsEvent = Utils.cond(
      [(this.state.viewMode === 'deleteEnvironmentOptions'), () => 'cloudEnvironmentDelete'],
      [(!!oldRuntime), () => 'cloudEnvironmentUpdate'],
      () => 'cloudEnvironmentCreate'
    )

    Ajax().Metrics.captureEvent(Events[metricsEvent], {
      ...extractWorkspaceDetails(this.makeWorkspaceObj()),
      ..._.mapKeys(key => `newRuntime_${key}`, newRuntime),
      newRuntime_exists: !!newRuntime,
      newRuntime_cpus: newRuntime && newRuntimeCpus,
      newRuntime_memory: newRuntime && newRuntimeMemory,
      newRuntime_costPerHour: newRuntime && runtimeConfigCost(this.getPendingRuntimeConfig()),
      newRuntime_pausedCostPerHour: newRuntime && runtimeConfigBaseCost(this.getPendingRuntimeConfig()),
      ..._.mapKeys(key => `oldRuntime_${key}`, oldRuntime),
      oldRuntime_exists: !!oldRuntime,
      oldRuntime_cpus: oldRuntime && oldRuntimeCpus,
      oldRuntime_memory: oldRuntime && oldRuntimeMemory,
      ..._.mapKeys(key => `newPersistentDisk_${key}`, newPersistentDisk),
      newPersistentDisk_costPerMonth: (newPersistentDisk && persistentDiskCostMonthly(this.getPendingDisk())),
      ..._.mapKeys(key => `oldPersistentDisk_${key}`, oldPersistentDisk),
      isDefaultConfig: !!this.state.simplifiedForm
    })
  }

  applyChanges = _.flow(
    Utils.withBusyState(() => this.setState({ loading: true })),
    withErrorReporting('Error creating cloud environment')
  )(async () => {
    const { onSuccess, namespace } = this.props
    const { currentRuntimeDetails, currentPersistentDiskDetails } = this.state
    const { runtime: oldRuntime, persistentDisk: oldPersistentDisk } = this.getOldEnvironmentConfig()
    const { runtime: newRuntime, persistentDisk: newPersistentDisk } = this.getNewEnvironmentConfig()
    const shouldUpdatePersistentDisk = this.canUpdatePersistentDisk() && !_.isEqual(newPersistentDisk, oldPersistentDisk)
    const shouldDeletePersistentDisk = oldPersistentDisk && !this.canUpdatePersistentDisk()
    const shouldUpdateRuntime = this.canUpdateRuntime() && !_.isEqual(newRuntime, oldRuntime)
    const shouldDeleteRuntime = oldRuntime && !this.canUpdateRuntime()
    const shouldCreateRuntime = !this.canUpdateRuntime() && newRuntime

    const runtimeConfig = newRuntime && {
      cloudService: newRuntime.cloudService,
      ...(newRuntime.cloudService === cloudServices.GCE ? {
        machineType: newRuntime.machineType,
        ...(newRuntime.diskSize ? {
          diskSize: newRuntime.diskSize
        } : {
          persistentDisk: oldPersistentDisk && !shouldDeletePersistentDisk ? {
            name: currentPersistentDiskDetails.name
          } : {
            name: Utils.generatePersistentDiskName(),
            size: newPersistentDisk.size
          }
        })
      } : {
        masterMachineType: newRuntime.masterMachineType,
        masterDiskSize: newRuntime.masterDiskSize,
        numberOfWorkers: newRuntime.numberOfWorkers,
        ...(newRuntime.numberOfWorkers && {
          numberOfPreemptibleWorkers: newRuntime.numberOfPreemptibleWorkers,
          workerMachineType: newRuntime.workerMachineType,
          workerDiskSize: newRuntime.workerDiskSize
        })
      })
    }

    this.sendCloudEnvironmentMetrics()

    if (shouldDeleteRuntime) {
      await Ajax().Runtimes.runtime(namespace, currentRuntimeDetails.runtimeName).delete(this.hasAttachedDisk() && shouldDeletePersistentDisk)
    }
    if (shouldDeletePersistentDisk && !this.hasAttachedDisk()) {
      await Ajax().Disks.disk(namespace, currentPersistentDiskDetails.name).delete()
    }
    if (shouldUpdatePersistentDisk) {
      await Ajax().Disks.disk(namespace, currentPersistentDiskDetails.name).update(newPersistentDisk.size)
    }
    if (shouldUpdateRuntime) {
      await Ajax().Runtimes.runtime(namespace, currentRuntimeDetails.runtimeName).update({ runtimeConfig })
    }
    if (shouldCreateRuntime) {
      await Ajax().Runtimes.runtime(namespace, Utils.generateRuntimeName()).create({
        runtimeConfig,
        toolDockerImage: newRuntime.toolDockerImage,
        ...(newRuntime.jupyterUserScriptUri ? { jupyterUserScriptUri: newRuntime.jupyterUserScriptUri } : {})
      })
    }

    onSuccess()
  })

  getNewEnvironmentConfig() {
    const {
      deleteDiskSelected, selectedPersistentDiskSize, viewMode, masterMachineType,
      masterDiskSize, sparkMode, numberOfWorkers, numberOfPreemptibleWorkers, workerMachineType,
      workerDiskSize, jupyterUserScriptUri, selectedLeoImage, customEnvImage
    } = this.state
    const { persistentDisk: oldPersistentDisk, runtime: oldRuntime } = this.getOldEnvironmentConfig()
    const cloudService = sparkMode ? cloudServices.DATAPROC : cloudServices.GCE
    const newNumberOfWorkers = sparkMode === 'cluster' ? numberOfWorkers : 0
    return {
      runtime: Utils.cond(
        [(viewMode !== 'deleteEnvironmentOptions'), () => {
          return {
            cloudService,
            toolDockerImage: selectedLeoImage === CUSTOM_MODE ? customEnvImage : selectedLeoImage,
            ...(jupyterUserScriptUri && { jupyterUserScriptUri }),
            ...(cloudService === cloudServices.GCE ? {
              machineType: masterMachineType,
              ...(this.shouldUsePersistentDisk() ? {
                persistentDiskAttached: true
              } : {
                diskSize: masterDiskSize
              })
            } : {
              masterMachineType,
              masterDiskSize,
              numberOfWorkers: newNumberOfWorkers,
              ...(newNumberOfWorkers && {
                numberOfPreemptibleWorkers,
                workerMachineType,
                workerDiskSize
              })
            })
          }
        }],
        [!deleteDiskSelected || oldRuntime?.persistentDiskAttached, () => undefined],
        () => oldRuntime
      ),
      persistentDisk: Utils.cond(
        [deleteDiskSelected, () => undefined],
        [viewMode !== 'deleteEnvironmentOptions' && this.shouldUsePersistentDisk(), () => ({ size: selectedPersistentDiskSize })],
        () => oldPersistentDisk
      )
    }
  }

  getOldEnvironmentConfig() {
    const { currentRuntimeDetails, currentPersistentDiskDetails } = this.state
    const runtimeConfig = currentRuntimeDetails?.runtimeConfig
    const cloudService = runtimeConfig?.cloudService
    const numberOfWorkers = runtimeConfig?.numberOfWorkers || 0
    return {
      runtime: currentRuntimeDetails ? {
        cloudService,
        toolDockerImage: this.getImageUrl(currentRuntimeDetails),
        ...(currentRuntimeDetails?.jupyterUserScriptUri && { jupyterUserScriptUri: currentRuntimeDetails?.jupyterUserScriptUri }),
        ...(cloudService === cloudServices.GCE ? {
          machineType: runtimeConfig.machineType,
          ...(runtimeConfig.persistentDiskId ? {
            persistentDiskAttached: true
          } : {
            diskSize: runtimeConfig.diskSize
          })
        } : {
          masterMachineType: runtimeConfig.masterMachineType || 'n1-standard-4',
          masterDiskSize: runtimeConfig.masterDiskSize || 100,
          numberOfWorkers,
          ...(numberOfWorkers && {
            numberOfPreemptibleWorkers: runtimeConfig.numberOfPreemptibleWorkers || 0,
            workerMachineType: runtimeConfig.workerMachineType || 'n1-standard-4',
            workerDiskSize: runtimeConfig.workerDiskSize || 100
          })
        })
      } : undefined,
      persistentDisk: currentPersistentDiskDetails ? { size: currentPersistentDiskDetails.size } : undefined
    }
  }

  hasAttachedDisk() {
    const { runtime: oldRuntime } = this.getOldEnvironmentConfig()
    return oldRuntime?.persistentDiskAttached
  }

  canUpdateRuntime() {
    const { runtime: oldRuntime } = this.getOldEnvironmentConfig()
    const { runtime: newRuntime } = this.getNewEnvironmentConfig()

    return !(
      !oldRuntime ||
      !newRuntime ||
      newRuntime.cloudService !== oldRuntime.cloudService ||
      newRuntime.toolDockerImage !== oldRuntime.toolDockerImage ||
      newRuntime.jupyterUserScriptUri !== oldRuntime.jupyterUserScriptUri ||
      (newRuntime.cloudService === cloudServices.GCE ? (
        newRuntime.persistentDiskAttached !== oldRuntime.persistentDiskAttached ||
        (newRuntime.persistentDiskAttached ? !this.canUpdatePersistentDisk() : newRuntime.diskSize < oldRuntime.diskSize)
      ) : (
        newRuntime.masterDiskSize < oldRuntime.masterDiskSize ||
        (newRuntime.numberOfWorkers > 0 && oldRuntime.numberOfWorkers === 0) ||
        (newRuntime.numberOfWorkers === 0 && oldRuntime.numberOfWorkers > 0) ||
        newRuntime.workerMachineType !== oldRuntime.workerMachineType ||
        newRuntime.workerDiskSize !== oldRuntime.workerDiskSize
      ))
    )
  }

  canUpdatePersistentDisk() {
    const { persistentDisk: oldPersistentDisk } = this.getOldEnvironmentConfig()
    const { persistentDisk: newPersistentDisk } = this.getNewEnvironmentConfig()

    return !(
      !oldPersistentDisk ||
      !newPersistentDisk ||
      newPersistentDisk.size < oldPersistentDisk.size
    )
  }

  hasChanges() {
    const oldConfig = this.getOldEnvironmentConfig()
    const newConfig = this.getNewEnvironmentConfig()

    return !_.isEqual(oldConfig, newConfig)
  }

  // original diagram (without PD) for update runtime logic: https://drive.google.com/file/d/1mtFFecpQTkGYWSgPlaHksYaIudWHa0dY/view
  isStopRequired() {
    const { runtime: oldRuntime } = this.getOldEnvironmentConfig()
    const { runtime: newRuntime } = this.getNewEnvironmentConfig()

    return this.canUpdateRuntime() &&
      (oldRuntime.cloudService === cloudServices.GCE ?
        oldRuntime.machineType !== newRuntime.machineType :
        oldRuntime.masterMachineType !== newRuntime.masterMachineType)
  }

  getImageUrl(runtimeDetails) {
    return _.find(({ imageType }) => _.includes(imageType, ['Jupyter', 'RStudio']), runtimeDetails?.runtimeImages)?.imageUrl
  }

  getCurrentMountDirectory(currentRuntimeDetails) {
    const rstudioMountPoint = '/home/rstudio'
    const jupyterMountPoint = '/home/jupyter-user/notebooks'
    const noMountDirectory = `${jupyterMountPoint} for Jupyter environments and ${rstudioMountPoint} for RStudio environments`
    return currentRuntimeDetails?.labels.tool ? (currentRuntimeDetails?.labels.tool === 'RStudio' ? rstudioMountPoint : jupyterMountPoint) : noMountDirectory
  }

  componentDidMount = _.flow(
    withErrorReporting('Error loading cloud environment'),
    Utils.withBusyState(v => this.setState({ loading: v }))
  )(async () => {
    const { namespace } = this.props
    const currentRuntime = this.getCurrentRuntime()
    const currentPersistentDisk = this.getCurrentPersistentDisk()

    Ajax().Metrics.captureEvent(Events.cloudEnvironmentConfigOpen, {
      existingConfig: !!currentRuntime, ...extractWorkspaceDetails(this.makeWorkspaceObj())
    })
    const [currentRuntimeDetails, newLeoImages, currentPersistentDiskDetails] = await Promise.all([
      currentRuntime ? Ajax().Runtimes.runtime(currentRuntime.googleProject, currentRuntime.runtimeName).details() : null,
      Ajax().Buckets.getObjectPreview('terra-docker-image-documentation', 'terra-docker-versions.json', namespace, true).then(res => res.json()),
      currentPersistentDisk ? Ajax().Disks.disk(currentPersistentDisk.googleProject, currentPersistentDisk.name).details() : null
    ])

    const imageUrl = currentRuntimeDetails ? this.getImageUrl(currentRuntimeDetails) : _.find({ id: 'terra-jupyter-gatk' }, newLeoImages).image
    const foundImage = _.find({ image: imageUrl }, newLeoImages)
    this.setState({
      leoImages: newLeoImages, currentRuntimeDetails, currentPersistentDiskDetails,
      selectedLeoImage: foundImage ? imageUrl : CUSTOM_MODE,
      customEnvImage: !foundImage ? imageUrl : '',
      jupyterUserScriptUri: currentRuntimeDetails?.jupyterUserScriptUri || '',
      ...this.getInitialState(currentRuntimeDetails, currentPersistentDiskDetails)
    })
  })

  renderDebugger() {
    const { showDebugger } = this.state
    const makeHeader = text => div({ style: { fontSize: 20, margin: '0.5rem 0' } }, [text])
    const makeJSON = value => div({ style: { whiteSpace: 'pre-wrap', fontFamily: 'Menlo, monospace' } }, [JSON.stringify(value, null, 2)])
    return showDebugger ?
      div({ style: { position: 'fixed', top: 0, left: 0, bottom: 0, right: '50vw', backgroundColor: 'white', padding: '1rem', overflowY: 'auto' } }, [
        h(Link, { onClick: () => this.setState({ showDebugger: false }), style: { position: 'absolute', top: 0, right: 0 } }, ['x']),
        makeHeader('Old Environment Config'),
        makeJSON(this.getOldEnvironmentConfig()),
        makeHeader('New Environment Config'),
        makeJSON(this.getNewEnvironmentConfig()),
        makeHeader('Misc'),
        makeJSON({
          canUpdateRuntime: !!this.canUpdateRuntime(),
          willDeleteBuiltinDisk: !!this.willDeleteBuiltinDisk(),
          willDeletePersistentDisk: !!this.willDeletePersistentDisk(),
          willRequireDowntime: !!this.willRequireDowntime()
        })
      ]) :
      h(Link, { onClick: () => this.setState({ showDebugger: true }), style: { position: 'fixed', top: 0, left: 0, color: 'white' } }, ['D'])
  }

  renderDeleteDiskChoices() {
    const { deleteDiskSelected, currentPersistentDiskDetails, currentRuntimeDetails } = this.state
    return h(Fragment, [
      h(RadioBlock, {
        name: 'delete-persistent-disk',
        labelText: 'Keep persistent disk, delete application configuration and compute profile',
        checked: !deleteDiskSelected,
        onChange: () => this.setState({ deleteDiskSelected: false })
      }, [
        p(['Please save your analysis data in the directory ', code({ style: { fontWeight: 600 } }, [this.getCurrentMountDirectory(currentRuntimeDetails)]), ' to ensure it’s stored on your disk.']),
        p([
          'Deletes your application configuration and cloud compute profile, but detaches your persistent disk and saves it for later. ',
          'The disk will be automatically reattached the next time you create a cloud environment using the standard VM compute type.'
        ]),
        p({ style: { marginBottom: 0 } }, [
          'You will continue to incur persistent disk cost at ',
          span({ style: { fontWeight: 600 } }, [Utils.formatUSD(persistentDiskCostMonthly(currentPersistentDiskDetails)), ' per month.'])
        ])
      ]),
      h(RadioBlock, {
        name: 'delete-persistent-disk',
        labelText: 'Delete everything, including persistent disk',
        checked: deleteDiskSelected,
        onChange: () => this.setState({ deleteDiskSelected: true }),
        style: { marginTop: '1rem' }
      }, [
        p([
          'Deletes your persistent disk, which will also ', span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
        ]),
        p({ style: { marginBottom: 0 } }, [
          'Also deletes your application configuration and cloud compute profile.'
        ])
      ]),
      h(SaveFilesHelp)
    ])
  }

  render() {
    const { onDismiss } = this.props
    const {
      masterMachineType, masterDiskSize, selectedPersistentDiskSize, sparkMode, workerMachineType,
      numberOfWorkers, numberOfPreemptibleWorkers, workerDiskSize,
      jupyterUserScriptUri, selectedLeoImage, customEnvImage, leoImages, viewMode, loading, simplifiedForm, deleteDiskSelected
    } = this.state
    const { version, updated, packages, requiresSpark, label: packageLabel } = _.find({ image: selectedLeoImage }, leoImages) || {}

    const isPersistentDisk = this.shouldUsePersistentDisk()

    const isCustomImage = selectedLeoImage === CUSTOM_MODE

    const machineTypeConstraints = { inclusion: { within: _.map('name', validMachineTypes), message: 'is not supported' } }
    const errors = validate(
      { masterMachineType, workerMachineType, customEnvImage },
      {
        masterMachineType: machineTypeConstraints,
        workerMachineType: machineTypeConstraints,
        customEnvImage: isCustomImage ? { format: { pattern: imageValidationRegexp } } : {}
      },
      {
        prettify: v => ({ customEnvImage: 'Container image', masterMachineType: 'Main CPU/memory', workerMachineType: 'Worker CPU/memory' }[v] ||
          validate.prettify(v))
      }
    )

    const renderActionButton = () => {
      const { runtime: oldRuntime } = this.getOldEnvironmentConfig()
      const { runtime: newRuntime } = this.getNewEnvironmentConfig()
      const commonButtonProps = { disabled: !this.hasChanges() || !!errors, tooltip: Utils.summarizeErrors(errors) }
      const canShowCustomImageWarning = viewMode === undefined
      const canShowEnvironmentWarning = _.includes(viewMode, [undefined, 'customImageWarning'])
      return Utils.cond(
        [canShowCustomImageWarning && isCustomImage && oldRuntime?.toolDockerImage !== newRuntime?.toolDockerImage, () => {
          return h(ButtonPrimary, { ...commonButtonProps, onClick: () => this.setState({ viewMode: 'customImageWarning' }) }, ['Next'])
        }],
        [canShowEnvironmentWarning && (this.willDeleteBuiltinDisk() || this.willDeletePersistentDisk() || this.willRequireDowntime() || this.willDetachPersistentDisk()), () => {
          return h(ButtonPrimary, { ...commonButtonProps, onClick: () => this.setState({ viewMode: 'environmentWarning' }) }, ['Next'])
        }],
        () => {
          return h(ButtonPrimary, {
            ...commonButtonProps,
            onClick: () => {
              this.applyChanges()
            }
          }, [
            Utils.cond(
              [viewMode === 'deleteEnvironmentOptions', () => 'Delete'],
              [oldRuntime, () => 'Update'],
              () => 'Create'
            )
          ])
        }
      )
    }

    const renderImageSelect = ({ includeCustom, ...props }) => {
      console.log(leoImages)
      return h(GroupedSelect, {
        ...props,
        maxMenuHeight: '25rem',
        value: selectedLeoImage,
        onChange: ({ value }) => {
          const requiresSpark = _.find({ image: value }, leoImages)?.requiresSpark
          this.setState({
            selectedLeoImage: value, customEnvImage: '',
            sparkMode: requiresSpark ? (sparkMode || 'master') : false
          })
        },
        isSearchable: true,
        isClearable: false,
        options: [
          {
            label: 'TERRA-MAINTAINED JUPYTER ENVIRONMENTS',
            options: _.map(({ label, image }) => ({ label, value: image }), _.filter(({ isCommunity, isRStudio }) => (!isCommunity && !isRStudio), leoImages))
          },
          {
            label: 'COMMUNITY-MAINTAINED JUPYTER ENVIRONMENTS (verified partners)',
            options: _.map(({ label, image }) => ({ label, value: image }), _.filter(({ isCommunity }) => isCommunity, leoImages))
          },
          {
            label: 'COMMUNITY-MAINTAINED RSTUDIO ENVIRONMENTS (verified partners)',
            options: _.map(({ label, image }) => ({ label, value: image }), _.filter(({ isRStudio }) => isRStudio, leoImages))
          },
          ...(includeCustom ? [{
            label: 'OTHER ENVIRONMENTS',
            options: [{ label: 'Custom Environment', value: CUSTOM_MODE }]
          }] : [])
        ]
      })
    }

    const renderCostBreakdown = () => {
      return div({
        style: {
          backgroundColor: colors.accent(0.2),
          display: 'flex',
          borderRadius: 5,
          padding: '0.5rem 1rem',
          marginTop: '1rem'
        }
      }, [
        _.map(({ cost, label, unitLabel }) => {
          return div({ key: label, style: { flex: 1, ...styles.label } }, [
            div({ style: { fontSize: 10 } }, [label]),
            div({ style: { color: colors.accent(), marginTop: '0.25rem' } }, [
              span({ style: { fontSize: 20 } }, [cost]),
              span([' ', unitLabel])
            ])
          ])
        }, [
          { label: 'Running cloud compute cost', cost: Utils.formatUSD(runtimeConfigCost(this.getPendingRuntimeConfig())), unitLabel: 'per hr' },
          { label: 'Paused cloud compute cost', cost: Utils.formatUSD(runtimeConfigBaseCost(this.getPendingRuntimeConfig())), unitLabel: 'per hr' },
          { label: 'Persistent disk cost', cost: isPersistentDisk ? Utils.formatUSD(persistentDiskCostMonthly(this.getPendingDisk())) : 'N/A', unitLabel: isPersistentDisk ? 'per month' : '' }
        ])
      ])
    }

    const renderApplicationSection = () => {
      return div({ style: styles.whiteBoxContainer }, [
        h(IdContainer, [
          id => h(Fragment, [
            div({ style: { marginBottom: '0.5rem' } }, [
              label({ htmlFor: id, style: styles.label }, ['Application configuration']),
              h(InfoBox, { style: { marginLeft: '0.5rem' } }, [
                'The software application + programming languages + packages used when you create your cloud environment. '
              ])
            ]),
            div({ style: { height: 45 } }, [renderImageSelect({ id, includeCustom: true })])
          ])
        ]),
        Utils.switchCase(selectedLeoImage,
          [CUSTOM_MODE, () => {
            return h(Fragment, [
              h(IdContainer, [
                id => h(Fragment, [
                  label({ htmlFor: id, style: { ...styles.label, display: 'block', margin: '0.5rem 0' } }, ['Container image']),
                  div({ style: { height: 52 } }, [
                    h(ValidatedInput, {
                      inputProps: {
                        id,
                        placeholder: '<image name>:<tag>',
                        value: customEnvImage,
                        onChange: customEnvImage => this.setState({ customEnvImage })
                      },
                      error: Utils.summarizeErrors(customEnvImage && errors?.customEnvImage)
                    })
                  ])
                ])
              ]),
              div([
                'Custom environments ', b(['must ']), 'be based off one of the ',
                h(Link, { href: terraBaseImages, ...Utils.newTabLinkProps }, ['Terra Jupyter Notebook base images'])
              ])
            ])
          }],
          [Utils.DEFAULT, () => {
            return h(Fragment, [
              div({ style: { display: 'flex' } }, [
                h(Link, { onClick: () => this.setState({ viewMode: 'packages' }) }, ['What’s installed on this environment?']),
                makeImageInfo({ marginLeft: 'auto' })
              ])
            ])
          }]
        )
      ])
    }

    const makeImageInfo = style => div({ style: { whiteSpace: 'pre', ...style } }, [
      div({ style: Style.proportionalNumbers }, ['Updated: ', updated ? Utils.makeStandardDate(updated) : null]),
      div(['Version: ', version || null])
    ])

    const renderRuntimeSection = () => {
      const gridStyle = { display: 'grid', gridTemplateColumns: '0.75fr 4.5rem 1fr 5.5rem 1fr 5.5rem', gridGap: '0.8rem', alignItems: 'center' }
      return div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
        div({ style: { fontSize: '0.875rem', fontWeight: 600 } }, ['Cloud compute profile']),
        div({ style: { ...gridStyle, marginTop: '0.75rem' } }, [
          h(MachineSelector, { value: masterMachineType, onChange: v => this.setState({ masterMachineType: v }) }),
          !isPersistentDisk ?
            h(DiskSelector, { value: masterDiskSize, onChange: v => this.setState({ masterDiskSize: v }) }) :
            div({ style: { gridColumnEnd: 'span 2' } }),
          h(IdContainer, [
            id => div({ style: { gridColumnEnd: 'span 6' } }, [
              label({ htmlFor: id, style: styles.label }, ['Startup script']),
              div({ style: { marginTop: '0.5rem' } }, [
                h(TextInput, {
                  id,
                  placeholder: 'URI',
                  value: jupyterUserScriptUri,
                  onChange: v => this.setState({ jupyterUserScriptUri: v })
                })
              ])
            ])
          ]),
          h(IdContainer, [
            id => div({ style: { gridColumnEnd: 'span 3' } }, [
              label({ htmlFor: id, style: styles.label }, ['Compute type']),
              div({ style: { marginTop: '0.5rem' } }, [
                h(Select, {
                  id,
                  isSearchable: false,
                  value: sparkMode,
                  onChange: ({ value }) => this.setState({ sparkMode: value }),
                  options: [
                    { value: false, label: 'Standard VM', isDisabled: requiresSpark },
                    { value: 'master', label: 'Spark master node' },
                    { value: 'cluster', label: 'Spark cluster' }
                  ]
                })
              ])
            ])
          ])
        ]),
        sparkMode === 'cluster' && fieldset({ style: { margin: '1.5rem 0 0', border: 'none', padding: 0 } }, [
          legend({ style: { padding: 0, ...styles.label } }, ['Worker config']),
          // grid styling in a div because of display issues in chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=375693
          div({ style: { ...gridStyle, marginTop: '0.75rem' } }, [
            h(IdContainer, [
              id => h(Fragment, [
                label({ htmlFor: id, style: styles.label }, ['Workers']),
                h(NumberInput, {
                  id,
                  min: 2,
                  isClearable: false,
                  onlyInteger: true,
                  value: numberOfWorkers,
                  onChange: v => this.setState({
                    numberOfWorkers: v
                  })
                })
              ])
            ]),
            h(IdContainer, [
              id => h(Fragment, [
                label({ htmlFor: id, style: styles.label }, ['Preemptible']),
                h(NumberInput, {
                  id,
                  min: 0,
                  isClearable: false,
                  onlyInteger: true,
                  value: numberOfPreemptibleWorkers,
                  onChange: v => this.setState({ numberOfPreemptibleWorkers: v })
                })
              ])
            ]),
            div({ style: { gridColumnEnd: 'span 2' } }),
            h(MachineSelector, { value: workerMachineType, onChange: v => this.setState({ workerMachineType: v }) }),
            h(DiskSelector, { value: workerDiskSize, onChange: v => this.setState({ workerDiskSize: v }) })
          ])
        ])
      ])
    }

    const renderPersistentDiskSection = () => {
      return div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
        h(IdContainer, [
          id => h(div, { style: { display: 'flex', flexDirection: 'column' } }, [
            label({ htmlFor: id, style: styles.label }, ['Persistent disk size (GB)']),
            div({ style: { marginTop: '0.5rem' } }, [
              'Stores your analysis data. ',
              h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about Persistent disks and where your disk is mounted'])
            ]),
            h(NumberInput, {
              id,
              min: 10,
              max: 64000,
              isClearable: false,
              onlyInteger: true,
              value: selectedPersistentDiskSize,
              style: { marginTop: '0.5rem', width: '5rem' },
              onChange: value => this.setState({ selectedPersistentDiskSize: value })
            })
          ])
        ])
      ])
    }

    const renderDeleteEnvironmentOptions = () => {
      const { runtime: oldRuntime, persistentDisk: oldPersistentDisk } = this.getOldEnvironmentConfig()
      return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
        h(TitleBar, {
          style: styles.titleBar,
          title: h(WarningTitle, ['Delete environment options']),
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined, deleteDiskSelected: false })
        }),
        div({ style: { lineHeight: '1.5rem' } }, [
          Utils.cond(
            [oldRuntime && oldPersistentDisk && !oldRuntime.persistentDiskAttached, () => {
              return h(Fragment, [
                h(RadioBlock, {
                  name: 'delete-persistent-disk',
                  labelText: 'Delete application configuration and cloud compute profile',
                  checked: !deleteDiskSelected,
                  onChange: () => this.setState({ deleteDiskSelected: false })
                }, [
                  p({ style: { marginBottom: 0 } }, [
                    'Deletes your application configuration and cloud compute profile. This will also ',
                    span({ style: { fontWeight: 600 } }, ['delete all files on the built-in hard disk.'])
                  ])
                ]),
                h(RadioBlock, {
                  name: 'delete-persistent-disk',
                  labelText: 'Delete persistent disk',
                  checked: deleteDiskSelected,
                  onChange: () => this.setState({ deleteDiskSelected: true }),
                  style: { marginTop: '1rem' }
                }, [
                  p([
                    'Deletes your persistent disk, which will also ', span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
                  ]),
                  p({ style: { marginBottom: 0 } }, [
                    'Since the persistent disk is not attached, the application configuration and cloud compute profile will remain.'
                  ])
                ]),
                h(SaveFilesHelp)
              ])
            }],
            [oldRuntime && oldPersistentDisk, () => this.renderDeleteDiskChoices()],
            [!oldRuntime && oldPersistentDisk, () => {
              return h(Fragment, [
                h(RadioBlock, {
                  name: 'delete-persistent-disk',
                  labelText: 'Delete persistent disk',
                  checked: deleteDiskSelected,
                  onChange: () => this.setState({ deleteDiskSelected: true })
                }, [
                  p([
                    'Deletes your persistent disk, which will also ', span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
                  ]),
                  p({ style: { marginBottom: 0 } }, [
                    'If you want to permanently save some files from the disk before deleting it, you will need to create a new cloud environment to access it.'
                  ])
                ]),
                h(SaveFilesHelp)
              ])
            }],
            () => {
              return h(Fragment, [
                p([
                  'Deleting your application configuration and cloud compute profile will also ',
                  span({ style: { fontWeight: 600 } }, ['delete all files on the built-in hard disk.'])
                ]),
                h(SaveFilesHelp)
              ])
            }
          )
        ]),
        div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
          renderActionButton()
        ])
      ])
    }
    const renderEnvironmentWarning = () => {
      return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
        h(TitleBar, {
          style: styles.titleBar,
          title: h(WarningTitle, [
            Utils.cond(
              [this.willDetachPersistentDisk(), () => 'Replace application configuration and cloud compute profile for Spark'],
              [this.willDeleteBuiltinDisk() || this.willDeletePersistentDisk(), () => 'Data will be deleted'],
              [this.willRequireDowntime(), () => 'Downtime required']
            )
          ]),
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined, deleteDiskSelected: false })
        }),
        div({ style: { lineHeight: 1.5 } }, [
          Utils.cond(
            [this.willDetachPersistentDisk(), () => h(Fragment, [
              div([
                'You have requested to replace your existing application configuration and cloud compute profile to ones that support Spark. ',
                'This type of cloud compute does not support the persistent disk feature.'
              ]),
              div({ style: { margin: '1rem 0 0.5rem', fontSize: 16, fontWeight: 600 } }, ['What would you like to do with your disk?']),
              this.renderDeleteDiskChoices()
            ])],
            [this.willDeleteBuiltinDisk(), () => h(Fragment, [
              p([
                'This change requires rebuilding your cloud environment, which will ',
                span({ style: { fontWeight: 600 } }, ['delete all files on built-in hard disk.'])
              ]),
              h(SaveFilesHelp)
            ])],
            [this.willDeletePersistentDisk(), () => h(Fragment, [
              p([
                'Reducing the size of a persistent disk requires it to be deleted and recreated. This will ',
                span({ style: { fontWeight: 600 } }, ['delete all files on the disk.'])
              ]),
              h(SaveFilesHelp)
            ])],
            [this.willRequireDowntime(), () => h(Fragment, [
              p(['This change will require temporarily shutting down your cloud environment. You will be unable to perform analysis for a few minutes.']),
              p(['Your existing data will be preserved during this update.'])
            ])]
          )
        ]),
        div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
          renderActionButton()
        ])
      ])
    }

    const renderCustomImageWarning = () => {
      return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
        h(TitleBar, {
          style: styles.titleBar,
          title: h(WarningTitle, ['Unverified Docker image']),
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined })
        }),
        div({ style: { lineHeight: 1.5 } }, [
          p([
            'You are about to create a virtual machine using an unverified Docker image. ',
            'Please make sure that it was created by you or someone you trust, using one of our ',
            h(Link, { href: terraBaseImages, ...Utils.newTabLinkProps }, ['base images.']),
            ' Custom Docker images could potentially cause serious security issues.'
          ]),
          h(Link, { href: safeImageDocumentation, ...Utils.newTabLinkProps }, ['Learn more about creating safe and secure custom Docker images.']),
          p(['If you\'re confident that your image is safe, you may continue using it. Otherwise, go back to select another image.'])
        ]),
        div({ style: { display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' } }, [
          renderActionButton()
        ])
      ])
    }


    const handleLearnMoreAboutPersistentDisk = () => {
      this.setState({ viewMode: 'aboutPersistentDisk' })
      Ajax().Metrics.captureEvent(Events.aboutPersistentDiskView, {
        ...extractWorkspaceDetails(this.makeWorkspaceObj()),
        currentlyHasAttachedDisk: !!this.hasAttachedDisk()
      })
    }

    const renderMainForm = () => {
      const { runtime: oldRuntime, persistentDisk: oldPersistentDisk } = this.getOldEnvironmentConfig()
      const { cpu, memory } = findMachineType(masterMachineType)
      const renderTitleAndTagline = () => {
        return h(Fragment, [
          h(TitleBar, {
            style: { marginBottom: '0.5rem' },
            title: 'Cloud environment',
            onDismiss
          }),
          div(['Cloud environments consist of an application configuration, cloud compute and a persistent disk'])
        ])
      }
      const renderBottomButtons = () => {
        return div({ style: { display: 'flex', marginTop: '2rem' } }, [
          (!!oldRuntime || !!oldPersistentDisk) && h(ButtonSecondary, {
            onClick: () => this.setState({ viewMode: 'deleteEnvironmentOptions' })
          }, [
            Utils.cond(
              [!!oldRuntime && !oldPersistentDisk, () => 'Delete Runtime'],
              [!oldRuntime && !!oldPersistentDisk, () => 'Delete Persistent Disk'],
              () => 'Delete Environment Options'
            )
          ]),
          div({ style: { flex: 1 } }),
          !simplifiedForm && renderActionButton()
        ])
      }
      const renderDiskText = () => {
        return span({ style: { fontWeight: 600 } }, [selectedPersistentDiskSize, ' GB persistent disk'])
      }
      return simplifiedForm ?
        div({ style: styles.drawerContent }, [
          renderTitleAndTagline(),
          div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
            div({ style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } }, [
              div({ style: { marginRight: '2rem' } }, [
                div({ style: { fontSize: 16, fontWeight: 600 } }, ['Use default environment']),
                ul({ style: { paddingLeft: '1rem', marginBottom: 0, lineHeight: 1.5 } }, [
                  li([
                    div([packageLabel]),
                    h(Link, { onClick: () => this.setState({ viewMode: 'packages' }) }, ['What’s installed on this environment?'])
                  ]),
                  li({ style: { marginTop: '1rem' } }, [
                    'Default compute size of ', span({ style: { fontWeight: 600 } }, [cpu, ' CPUs']), ', ',
                    span({ style: { fontWeight: 600 } }, [memory, ' GB memory']), ', and ',
                    oldPersistentDisk ?
                      h(Fragment, ['your existing ', renderDiskText()]) :
                      h(Fragment, ['a ', renderDiskText(), ' to keep your data even after you delete your compute'])
                  ]),
                  li({ style: { marginTop: '1rem' } }, [
                    h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about Persistent disks and where your disk is mounted'])
                  ])
                ])
              ]),
              renderActionButton()
            ]),
            renderCostBreakdown()
          ]),
          div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
            div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
              div({ style: { fontSize: 16, fontWeight: 600 } }, ['Create custom environment']),
              h(ButtonOutline, { onClick: () => this.setState({ simplifiedForm: false }) }, ['Customize'])
            ])
          ]),
          renderBottomButtons()
        ]) :
        h(Fragment, [
          div({ style: { padding: '1.5rem', borderBottom: `1px solid ${colors.dark(0.4)}` } }, [
            renderTitleAndTagline(),
            renderCostBreakdown()
          ]),
          div({ style: { padding: '1.5rem', overflowY: 'auto', flex: 'auto' } }, [
            renderApplicationSection(),
            renderRuntimeSection(),
            !!isPersistentDisk && renderPersistentDiskSection(),
            !sparkMode && !isPersistentDisk && div({ style: { ...styles.whiteBoxContainer, marginTop: '1rem' } }, [
              div([
                'Time to upgrade your cloud environment. Terra’s new persistent disk feature will safeguard your work and data. ',
                h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about Persistent disks and where your disk is mounted'])
              ]),
              h(ButtonOutline, {
                style: { marginTop: '1rem' },
                tooltip: 'Upgrade your environment to use a persistent disk. This will require a one-time deletion of your current built-in disk, but after that your data will be stored and preserved on the persistent disk.',
                onClick: () => this.setState({ upgradeDiskSelected: true })
              }, ['Upgrade'])
            ]),
            renderBottomButtons()
          ])
        ])
    }

    const renderAboutPersistentDisk = () => {
      const { currentRuntimeDetails } = this.state
      return div({ style: styles.drawerContent }, [
        h(TitleBar, {
          style: styles.titleBar,
          title: 'About persistent disk',
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined })
        }),
        div({ style: { lineHeight: 1.5 } }, [
          p(['Your persistent disk is mounted in the directory ', code({ style: { fontWeight: 600 } }, [this.getCurrentMountDirectory(currentRuntimeDetails)]), br(), 'Please save your analysis data in this directory to ensure it’s stored on your disk.']),
          p(['Terra attaches a persistent disk (PD) to your cloud compute in order to provide an option to keep the data on the disk after you delete your compute. PDs also act as a safeguard to protect your data in the case that something goes wrong with the compute.']),
          p(['A minimal cost per hour is associated with maintaining the disk even when the cloud compute is paused or deleted.']),
          p(['If you delete your cloud compute, but keep your PD, the PD will be reattached when creating the next cloud compute.']),
          h(Link, { href: 'https://support.terra.bio/hc/en-us/articles/360047318551', ...Utils.newTabLinkProps }, [
            'Learn more about about persistent disks in the Terra Support site',
            icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })
          ])
        ])
      ])
    }

    const renderPackages = () => {
      return div({ style: styles.drawerContent }, [
        h(TitleBar, {
          style: styles.titleBar,
          title: 'Installed packages',
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined })
        }),
        renderImageSelect({ 'aria-label': 'Select Environment' }),
        makeImageInfo({ margin: '1rem 0 0.5rem' }),
        packages && h(ImageDepViewer, { packageLink: packages })
      ])
    }

    return h(Fragment, [
      Utils.switchCase(viewMode,
        ['packages', renderPackages],
        ['aboutPersistentDisk', renderAboutPersistentDisk],
        ['customImageWarning', renderCustomImageWarning],
        ['environmentWarning', renderEnvironmentWarning],
        ['deleteEnvironmentOptions', renderDeleteEnvironmentOptions],
        [Utils.DEFAULT, renderMainForm]
      ),
      loading && spinnerOverlay,
      showDebugPanel && this.renderDebugger()
    ])
  }

  willDetachPersistentDisk() {
    const { runtime: newRuntime } = this.getNewEnvironmentConfig()
    return newRuntime.cloudService === cloudServices.DATAPROC && this.hasAttachedDisk()
  }

  shouldUsePersistentDisk() {
    const { sparkMode, upgradeDiskSelected, currentRuntimeDetails } = this.state
    return !sparkMode && (!currentRuntimeDetails?.runtimeConfig.diskSize || upgradeDiskSelected)
  }

  willDeletePersistentDisk() {
    const { persistentDisk: oldPersistentDisk } = this.getOldEnvironmentConfig()
    return oldPersistentDisk && !this.canUpdatePersistentDisk()
  }

  willDeleteBuiltinDisk() {
    const { runtime: oldRuntime } = this.getOldEnvironmentConfig()
    return (oldRuntime?.diskSize || oldRuntime?.masterDiskSize) && !this.canUpdateRuntime()
  }

  willRequireDowntime() {
    const { runtime: oldRuntime } = this.getOldEnvironmentConfig()
    return oldRuntime && (!this.canUpdateRuntime() || this.isStopRequired())
  }
})
