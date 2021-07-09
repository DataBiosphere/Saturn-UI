import _ from 'lodash/fp'
import PropTypes from 'prop-types'
import { Component, Fragment } from 'react'
import { b, br, code, div, fieldset, h, label, legend, li, p, span, ul } from 'react-hyperscript-helpers'
import { ButtonOutline, ButtonPrimary, ButtonSecondary, GroupedSelect, IdContainer, Link, Select, spinnerOverlay, WarningTitle } from 'src/components/common'
import { icon } from 'src/components/icons'
import { ImageDepViewer } from 'src/components/ImageDepViewer'
import { NumberInput, TextInput, ValidatedInput } from 'src/components/input'
import { withModalDrawer } from 'src/components/ModalDrawer'
import { tools } from 'src/components/notebook-utils'
import { InfoBox } from 'src/components/PopupTrigger'
import { SaveFilesHelp } from 'src/components/runtime-common'
import TitleBar from 'src/components/TitleBar'
import { cloudServices, machineTypes } from 'src/data/machines'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { withErrorReporting } from 'src/libs/error'
import Events, { extractWorkspaceDetails } from 'src/libs/events'
import {
  getCurrentRuntime, DEFAULT_DISK_SIZE, defaultDataprocMachineType, defaultGceMachineType, findMachineType, getDefaultMachineType,
  persistentDiskCostMonthly,
  RadioBlock,
  runtimeConfigBaseCost, runtimeConfigCost
} from 'src/libs/runtime-utils'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


// Change to true to enable a debugging panel (intended for dev mode only)
const showDebugPanel = false
const titleId = 'new-runtime-modal-title'

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

const MachineSelector = ({ value, machineTypeOptions, onChange }) => {
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
            onChange: option => onChange(_.find({ cpu: option.value }, machineTypeOptions)?.name || value),
            options: _.flow(_.map('cpu'), _.union([currentCpu]), _.sortBy(_.identity))(machineTypeOptions)
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
            onChange: option => onChange(_.find({ cpu: currentCpu, memory: option.value }, machineTypeOptions)?.name || value),
            options: _.flow(_.filter({ cpu: currentCpu }), _.map('memory'), _.union([currentMemory]), _.sortBy(_.identity))(machineTypeOptions)
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

const CUSTOM_MODE = '__custom_mode__'

export class NewRuntimeModalBase extends Component {
  static propTypes = {
    runtimes: PropTypes.array,
    persistentDisks: PropTypes.array,
    workspace: PropTypes.object.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    isAnalysisMode: PropTypes.bool,
    tool: PropTypes.string
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
      //TODO: once this uses a wizard approach, we need to modify this to start in a default state
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
      masterMachineType: runtimeConfig?.masterMachineType || runtimeConfig?.machineType,
      masterDiskSize: runtimeConfig?.masterDiskSize || runtimeConfig?.diskSize || DEFAULT_DISK_SIZE,
      numberOfWorkers: runtimeConfig?.numberOfWorkers || 2,
      numberOfPreemptibleWorkers: runtimeConfig?.numberOfPreemptibleWorkers || 0,
      workerMachineType: runtimeConfig?.workerMachineType || defaultDataprocMachineType,
      workerDiskSize: runtimeConfig?.workerDiskSize || DEFAULT_DISK_SIZE
    }
  }

  getWorkspaceObj() {
    return this.props.workspace.workspace
  }

  getCurrentRuntime() {
    const { runtimes } = this.props
    return getCurrentRuntime(runtimes)
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
    const { runtime: desiredRuntime } = this.getDesiredEnvironmentConfig()

    return {
      cloudService: desiredRuntime.cloudService,
      ...(desiredRuntime.cloudService === cloudServices.GCE ? {
        machineType: desiredRuntime.machineType || defaultGceMachineType,
        bootDiskSize: desiredRuntime.bootDiskSize,
        ...(desiredRuntime.diskSize ? {
          diskSize: desiredRuntime.diskSize
        } : {})
      } : {
        masterMachineType: desiredRuntime.masterMachineType || defaultDataprocMachineType,
        masterDiskSize: desiredRuntime.masterDiskSize,
        numberOfWorkers: desiredRuntime.numberOfWorkers,
        ...(desiredRuntime.numberOfWorkers && {
          numberOfPreemptibleWorkers: desiredRuntime.numberOfPreemptibleWorkers,
          workerMachineType: desiredRuntime.workerMachineType,
          workerDiskSize: desiredRuntime.workerDiskSize
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
    const { persistentDisk: desiredPersistentDisk } = this.getDesiredEnvironmentConfig()
    return { size: desiredPersistentDisk.size, status: 'Ready' }
  }

  sendCloudEnvironmentMetrics() {
    const { runtime: desiredRuntime, persistentDisk: desiredPersistentDisk } = this.getDesiredEnvironmentConfig()
    const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = this.getExistingEnvironmentConfig()
    const desiredMachineType = desiredRuntime && (desiredRuntime.cloudService === cloudServices.GCE ? desiredRuntime.machineType : desiredRuntime.masterMachineType)
    const existingMachineType = existingRuntime && (existingRuntime?.cloudService === cloudServices.GCE ? existingRuntime.machineType : existingRuntime.masterMachineType)
    const { cpu: desiredRuntimeCpus, memory: desiredRuntimeMemory } = findMachineType(desiredMachineType)
    const { cpu: existingRuntimeCpus, memory: existingRuntimeMemory } = findMachineType(existingMachineType)
    const metricsEvent = Utils.cond(
      [(this.state.viewMode === 'deleteEnvironmentOptions'), () => 'cloudEnvironmentDelete'],
      [(!!existingRuntime), () => 'cloudEnvironmentUpdate'],
      () => 'cloudEnvironmentCreate'
    )

    Ajax().Metrics.captureEvent(Events[metricsEvent], {
      ...extractWorkspaceDetails(this.getWorkspaceObj()),
      ..._.mapKeys(key => `desiredRuntime_${key}`, desiredRuntime),
      desiredRuntime_exists: !!desiredRuntime,
      desiredRuntime_cpus: desiredRuntime && desiredRuntimeCpus,
      desiredRuntime_memory: desiredRuntime && desiredRuntimeMemory,
      desiredRuntime_costPerHour: desiredRuntime && runtimeConfigCost(this.getPendingRuntimeConfig()),
      desiredRuntime_pausedCostPerHour: desiredRuntime && runtimeConfigBaseCost(this.getPendingRuntimeConfig()),
      ..._.mapKeys(key => `existingRuntime_${key}`, existingRuntime),
      existingRuntime_exists: !!existingRuntime,
      existingRuntime_cpus: existingRuntime && existingRuntimeCpus,
      existingRuntime_memory: existingRuntime && existingRuntimeMemory,
      ..._.mapKeys(key => `desiredPersistentDisk_${key}`, desiredPersistentDisk),
      desiredPersistentDisk_costPerMonth: (desiredPersistentDisk && persistentDiskCostMonthly(this.getPendingDisk())),
      ..._.mapKeys(key => `existingPersistentDisk_${key}`, existingPersistentDisk),
      isDefaultConfig: !!this.state.simplifiedForm
    })
  }

  applyChanges = _.flow(
    Utils.withBusyState(() => this.setState({ loading: true })),
    withErrorReporting('Error creating cloud environment')
  )(async () => {
    const { onSuccess } = this.props
    const { currentRuntimeDetails, currentPersistentDiskDetails } = this.state
    const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = this.getExistingEnvironmentConfig()
    const { runtime: desiredRuntime, persistentDisk: desiredPersistentDisk } = this.getDesiredEnvironmentConfig()
    const shouldUpdatePersistentDisk = this.canUpdatePersistentDisk() && !_.isEqual(desiredPersistentDisk, existingPersistentDisk)
    const shouldDeletePersistentDisk = existingPersistentDisk && !this.canUpdatePersistentDisk()
    const shouldUpdateRuntime = this.canUpdateRuntime() && !_.isEqual(desiredRuntime, existingRuntime)
    const shouldDeleteRuntime = existingRuntime && !this.canUpdateRuntime()
    const shouldCreateRuntime = !this.canUpdateRuntime() && desiredRuntime
    const { name, bucketName, googleProject } = this.getWorkspaceObj()

    const runtimeConfig = desiredRuntime && {
      cloudService: desiredRuntime.cloudService,
      ...(desiredRuntime.cloudService === cloudServices.GCE ? {
        machineType: desiredRuntime.machineType || defaultGceMachineType,
        ...(desiredRuntime.diskSize ? {
          diskSize: desiredRuntime.diskSize
        } : {
          persistentDisk: existingPersistentDisk && !shouldDeletePersistentDisk ? {
            name: currentPersistentDiskDetails.name
          } : {
            name: Utils.generatePersistentDiskName(),
            size: desiredPersistentDisk.size,
            labels: { saturnWorkspaceName: name }
          }
        })
      } : {
        masterMachineType: desiredRuntime.masterMachineType || defaultDataprocMachineType,
        masterDiskSize: desiredRuntime.masterDiskSize,
        numberOfWorkers: desiredRuntime.numberOfWorkers,
        ...(desiredRuntime.numberOfWorkers && {
          numberOfPreemptibleWorkers: desiredRuntime.numberOfPreemptibleWorkers,
          workerMachineType: desiredRuntime.workerMachineType,
          workerDiskSize: desiredRuntime.workerDiskSize
        })
      })
    }

    const customEnvVars = {
      WORKSPACE_NAME: name,
      WORKSPACE_BUCKET: `gs://${bucketName}`,
      GOOGLE_PROJECT: googleProject
    }

    this.sendCloudEnvironmentMetrics()

    if (shouldDeleteRuntime) {
      await Ajax().Runtimes.runtime(googleProject, currentRuntimeDetails.runtimeName).delete(this.hasAttachedDisk() && shouldDeletePersistentDisk)
    }
    if (shouldDeletePersistentDisk && !this.hasAttachedDisk()) {
      await Ajax().Disks.disk(googleProject, currentPersistentDiskDetails.name).delete()
    }
    if (shouldUpdatePersistentDisk) {
      await Ajax().Disks.disk(googleProject, currentPersistentDiskDetails.name).update(desiredPersistentDisk.size)
    }
    if (shouldUpdateRuntime) {
      await Ajax().Runtimes.runtime(googleProject, currentRuntimeDetails.runtimeName).update({ runtimeConfig })
    }
    if (shouldCreateRuntime) {
      await Ajax().Runtimes.runtime(googleProject, Utils.generateRuntimeName()).create({
        runtimeConfig,
        toolDockerImage: desiredRuntime.toolDockerImage,
        labels: { saturnWorkspaceName: name },
        customEnvironmentVariables: customEnvVars,
        ...(desiredRuntime.jupyterUserScriptUri ? { jupyterUserScriptUri: desiredRuntime.jupyterUserScriptUri } : {})
      })
    }

    onSuccess()
  })

  getDesiredEnvironmentConfig() {
    const {
      deleteDiskSelected, selectedPersistentDiskSize, viewMode, masterMachineType,
      masterDiskSize, sparkMode, numberOfWorkers, numberOfPreemptibleWorkers, workerMachineType,
      workerDiskSize, jupyterUserScriptUri, selectedLeoImage, customEnvImage
    } = this.state
    const { persistentDisk: existingPersistentDisk, runtime: existingRuntime } = this.getExistingEnvironmentConfig()
    const cloudService = sparkMode ? cloudServices.DATAPROC : cloudServices.GCE
    const desiredNumberOfWorkers = sparkMode === 'cluster' ? numberOfWorkers : 0
    return {
      runtime: Utils.cond(
        [(viewMode !== 'deleteEnvironmentOptions'), () => {
          return {
            cloudService,
            toolDockerImage: selectedLeoImage === CUSTOM_MODE ? customEnvImage : selectedLeoImage,
            ...(jupyterUserScriptUri && { jupyterUserScriptUri }),
            ...(cloudService === cloudServices.GCE ? {
              machineType: masterMachineType || defaultGceMachineType,
              bootDiskSize: existingRuntime?.bootDiskSize,
              ...(this.shouldUsePersistentDisk() ? {
                persistentDiskAttached: true
              } : {
                diskSize: masterDiskSize
              })
            } : {
              masterMachineType: masterMachineType || defaultDataprocMachineType,
              masterDiskSize,
              numberOfWorkers: desiredNumberOfWorkers,
              ...(desiredNumberOfWorkers && {
                numberOfPreemptibleWorkers,
                workerMachineType: workerMachineType || defaultDataprocMachineType,
                workerDiskSize
              })
            })
          }
        }],
        [!deleteDiskSelected || existingRuntime?.persistentDiskAttached, () => undefined],
        () => existingRuntime
      ),
      persistentDisk: Utils.cond(
        [deleteDiskSelected, () => undefined],
        [viewMode !== 'deleteEnvironmentOptions' && this.shouldUsePersistentDisk(), () => ({ size: selectedPersistentDiskSize })],
        () => existingPersistentDisk
      )
    }
  }

  getExistingEnvironmentConfig() {
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
          machineType: runtimeConfig.machineType || defaultGceMachineType,
          bootDiskSize: runtimeConfig.bootDiskSize,
          ...(runtimeConfig.persistentDiskId ? {
            persistentDiskAttached: true
          } : {
            diskSize: runtimeConfig.diskSize
          })
        } : {
          masterMachineType: runtimeConfig.masterMachineType || defaultDataprocMachineType,
          masterDiskSize: runtimeConfig.masterDiskSize || 100,
          numberOfWorkers,
          ...(numberOfWorkers && {
            numberOfPreemptibleWorkers: runtimeConfig.numberOfPreemptibleWorkers || 0,
            workerMachineType: runtimeConfig.workerMachineType || defaultDataprocMachineType,
            workerDiskSize: runtimeConfig.workerDiskSize || 100
          })
        })
      } : undefined,
      persistentDisk: currentPersistentDiskDetails ? { size: currentPersistentDiskDetails.size } : undefined
    }
  }

  hasAttachedDisk() {
    const { runtime: existingRuntime } = this.getExistingEnvironmentConfig()
    return existingRuntime?.persistentDiskAttached
  }

  canUpdateNumberOfWorkers() {
    const { currentRuntimeDetails } = this.state
    return !currentRuntimeDetails || currentRuntimeDetails.status === 'Running'
  }

  canUpdateRuntime() {
    const { runtime: existingRuntime } = this.getExistingEnvironmentConfig()
    const { runtime: desiredRuntime } = this.getDesiredEnvironmentConfig()

    return !(
      !existingRuntime ||
      !desiredRuntime ||
      desiredRuntime.cloudService !== existingRuntime.cloudService ||
      desiredRuntime.toolDockerImage !== existingRuntime.toolDockerImage ||
      desiredRuntime.jupyterUserScriptUri !== existingRuntime.jupyterUserScriptUri ||
      (desiredRuntime.cloudService === cloudServices.GCE ? (
        desiredRuntime.persistentDiskAttached !== existingRuntime.persistentDiskAttached ||
        (desiredRuntime.persistentDiskAttached ? !this.canUpdatePersistentDisk() : desiredRuntime.diskSize < existingRuntime.diskSize)
      ) : (
        desiredRuntime.masterDiskSize < existingRuntime.masterDiskSize ||
        (desiredRuntime.numberOfWorkers > 0 && existingRuntime.numberOfWorkers === 0) ||
        (desiredRuntime.numberOfWorkers === 0 && existingRuntime.numberOfWorkers > 0) ||
        desiredRuntime.workerMachineType !== existingRuntime.workerMachineType ||
        desiredRuntime.workerDiskSize !== existingRuntime.workerDiskSize
      ))
    )
  }

  canUpdatePersistentDisk() {
    const { persistentDisk: existingPersistentDisk } = this.getExistingEnvironmentConfig()
    const { persistentDisk: desiredPersistentDisk } = this.getDesiredEnvironmentConfig()

    return !(
      !existingPersistentDisk ||
      !desiredPersistentDisk ||
      desiredPersistentDisk.size < existingPersistentDisk.size
    )
  }

  hasChanges() {
    const existingConfig = this.getExistingEnvironmentConfig()
    const desiredConfig = this.getDesiredEnvironmentConfig()

    return !_.isEqual(existingConfig, desiredConfig)
  }

  // original diagram (without PD) for update runtime logic: https://drive.google.com/file/d/1mtFFecpQTkGYWSgPlaHksYaIudWHa0dY/view
  isStopRequired() {
    const { runtime: existingRuntime } = this.getExistingEnvironmentConfig()
    const { runtime: desiredRuntime } = this.getDesiredEnvironmentConfig()

    return this.canUpdateRuntime() &&
      (existingRuntime.cloudService === cloudServices.GCE ?
        existingRuntime.machineType !== desiredRuntime.machineType :
        existingRuntime.masterMachineType !== desiredRuntime.masterMachineType)
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
    const { googleProject } = this.getWorkspaceObj()
    const currentRuntime = this.getCurrentRuntime()
    const currentPersistentDisk = this.getCurrentPersistentDisk()
    const { tool } = this.props

    Ajax().Metrics.captureEvent(Events.cloudEnvironmentConfigOpen, {
      existingConfig: !!currentRuntime, ...extractWorkspaceDetails(this.getWorkspaceObj())
    })
    const [currentRuntimeDetails, newLeoImages, currentPersistentDiskDetails] = await Promise.all([
      currentRuntime ? Ajax().Runtimes.runtime(currentRuntime.googleProject, currentRuntime.runtimeName).details() : null,
      Ajax().Buckets.getObjectPreview('terra-docker-image-documentation', 'terra-docker-versions.json', googleProject, true).then(res => res.json()),
      currentPersistentDisk ? Ajax().Disks.disk(currentPersistentDisk.googleProject, currentPersistentDisk.name).details() : null
    ])

    const filteredNewLeoImages = !!tool ? _.filter(image => _.includes(image.id, tools[tool].imageIds), newLeoImages) : newLeoImages

    const imageUrl = currentRuntimeDetails ? this.getImageUrl(currentRuntimeDetails) : _.find({ id: 'terra-jupyter-gatk' }, newLeoImages).image
    const foundImage = _.find({ image: imageUrl }, newLeoImages)

    /* eslint-disable indent */
    //TODO: open to feedback and still thinking about this...
    //Selected Leo image uses the following logic (psuedoCode not written in same way as code for clarity)
    //if found image (aka image associated with users runtime) NOT in newLeoImages (the image dropdown list from bucket)
      //user is using custom image
    //else
      //if found Image NOT in filteredNewLeoImages (filtered based on analysis tool selection) and isAnalysisMode
        //use default image for selected tool
      //else
        //use imageUrl derived from users current runtime
    /* eslint-disable indent */
    const getSelectedImage = () => {
      if (foundImage) {
        if (!_.includes(foundImage, filteredNewLeoImages) && this.props.isAnalysisMode) {
          return _.find({ id: tools[this.props.tool].defaultImageId }, newLeoImages).image
        } else {
         return imageUrl
        }
      } else {
        return CUSTOM_MODE
      }
    }

    this.setState({
      leoImages: filteredNewLeoImages, currentRuntimeDetails, currentPersistentDiskDetails,
      selectedLeoImage: getSelectedImage(),
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
        makeJSON(this.getExistingEnvironmentConfig()),
        makeHeader('New Environment Config'),
        makeJSON(this.getDesiredEnvironmentConfig()),
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
        name: 'keep-persistent-disk',
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
    const { onDismiss, isAnalysisMode } = this.props
    const {
      masterMachineType, masterDiskSize, selectedPersistentDiskSize, sparkMode, workerMachineType,
      numberOfWorkers, numberOfPreemptibleWorkers, workerDiskSize,
      jupyterUserScriptUri, selectedLeoImage, customEnvImage, leoImages, viewMode, loading, simplifiedForm, deleteDiskSelected
    } = this.state
    const { version, updated, packages, requiresSpark, label: packageLabel } = _.find({ image: selectedLeoImage }, leoImages) || {}

    const isPersistentDisk = this.shouldUsePersistentDisk()

    const isCustomImage = selectedLeoImage === CUSTOM_MODE

    const minRequiredMemory = sparkMode ? 7.5 : 3.75
    const validMachineTypes = _.filter(({ memory }) => memory >= minRequiredMemory, machineTypes)
    const mainMachineType = _.find({ name: masterMachineType }, validMachineTypes)?.name || getDefaultMachineType(sparkMode)
    const machineTypeConstraints = { inclusion: { within: _.map('name', validMachineTypes), message: 'is not supported' } }
    const errors = validate(
      { mainMachineType, workerMachineType, customEnvImage },
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
      const { runtime: existingRuntime } = this.getExistingEnvironmentConfig()
      const { runtime: desiredRuntime } = this.getDesiredEnvironmentConfig()
      const commonButtonProps = { disabled: !this.hasChanges() || !!errors, tooltip: Utils.summarizeErrors(errors) }
      const canShowCustomImageWarning = viewMode === undefined
      const canShowEnvironmentWarning = _.includes(viewMode, [undefined, 'customImageWarning'])
      return Utils.cond(
        [canShowCustomImageWarning && isCustomImage && existingRuntime?.toolDockerImage !== desiredRuntime?.toolDockerImage, () => {
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
              [existingRuntime, () => 'Update'],
              () => 'Create'
            )
          ])
        }
      )
    }

    const renderImageSelect = ({ includeCustom, ...props }) => {
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
            div({ style: { color: colors.accent(1.1), marginTop: '0.25rem' } }, [
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
          h(MachineSelector, { value: mainMachineType, machineTypeOptions: validMachineTypes, onChange: v => this.setState({ masterMachineType: v }) }),
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
                  disabled: !this.canUpdateNumberOfWorkers(),
                  tooltip: !this.canUpdateNumberOfWorkers() ? 'Cloud Compute must be in Running status to change number of workers.' : undefined,
                  onChange: v => this.setState({
                    numberOfWorkers: v
                  })
                })
              ])
            ]),
            h(IdContainer, [
              id => h(Fragment, [
                label({ htmlFor: id, style: styles.label }, ['Preemptibles']),
                h(NumberInput, {
                  id,
                  min: 0,
                  isClearable: false,
                  onlyInteger: true,
                  value: numberOfPreemptibleWorkers,
                  disabled: !this.canUpdateNumberOfWorkers(),
                  tooltip: !this.canUpdateNumberOfWorkers() ? 'Cloud Compute must be in Running status to change number of preemptibles' : undefined,
                  onChange: v => this.setState({ numberOfPreemptibleWorkers: v })
                })
              ])
            ]),
            div({ style: { gridColumnEnd: 'span 2' } }),
            h(MachineSelector, { value: workerMachineType, machineTypeOptions: validMachineTypes, onChange: v => this.setState({ workerMachineType: v }) }),
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
              'Persistent disks store analysis data. ',
              h(Link, { onClick: handleLearnMoreAboutPersistentDisk }, ['Learn more about persistent disks and where your disk is mounted.'])
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
      const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = this.getExistingEnvironmentConfig()
      return div({ style: { ...styles.drawerContent, ...styles.warningView } }, [
        h(TitleBar, {
          id: titleId,
          style: styles.titleBar,
          title: h(WarningTitle, ['Delete environment options']),
          hideCloseButton: isAnalysisMode,
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined, deleteDiskSelected: false })
        }),
        div({ style: { lineHeight: '1.5rem' } }, [
          Utils.cond(
            [existingRuntime && existingPersistentDisk && !existingRuntime.persistentDiskAttached, () => {
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
            [existingRuntime && existingPersistentDisk, () => this.renderDeleteDiskChoices()],
            [!existingRuntime && existingPersistentDisk, () => {
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
          id: titleId,
          style: styles.titleBar,
          hideCloseButton: isAnalysisMode,
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
          id: titleId,
          hideCloseButton: isAnalysisMode,
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
        ...extractWorkspaceDetails(this.getWorkspaceObj()),
        currentlyHasAttachedDisk: !!this.hasAttachedDisk()
      })
    }

    const renderMainForm = () => {
      const { runtime: existingRuntime, persistentDisk: existingPersistentDisk } = this.getExistingEnvironmentConfig()
      const { cpu, memory } = findMachineType(mainMachineType)
      const renderTitleAndTagline = () => {
        return h(Fragment, [
          h(TitleBar, {
            id: titleId,
            style: { marginBottom: '0.5rem' },
            title: 'Cloud Environment',
            hideCloseButton: isAnalysisMode,
            onDismiss
          }),
          div(['A cloud environment consists of application configuration, cloud compute and persistent disk(s).'])
        ])
      }
      const renderBottomButtons = () => {
        return div({ style: { display: 'flex', marginTop: '2rem' } }, [
          (!!existingRuntime || !!existingPersistentDisk) && h(ButtonSecondary, {
            onClick: () => this.setState({ viewMode: 'deleteEnvironmentOptions' })
          }, [
            Utils.cond(
              [!!existingRuntime && !existingPersistentDisk, () => 'Delete Runtime'],
              [!existingRuntime && !!existingPersistentDisk, () => 'Delete Persistent Disk'],
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
                    'Default compute size of ', span({ style: { fontWeight: 600 } }, [cpu, ' CPU(s)']), ', ',
                    span({ style: { fontWeight: 600 } }, [memory, ' GB memory']), ', and ',
                    existingPersistentDisk ?
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
          id: titleId,
          style: styles.titleBar,
          title: 'About persistent disk',
          hideCloseButton: isAnalysisMode,
          onDismiss,
          onPrevious: () => this.setState({ viewMode: undefined })
        }),
        div({ style: { lineHeight: 1.5 } }, [
          p(['Your persistent disk is mounted in the directory ', code({ style: { fontWeight: 600 } }, [this.getCurrentMountDirectory(currentRuntimeDetails)]), br(), 'Please save your analysis data in this directory to ensure it’s stored on your disk.']),
          p(['Terra attaches a persistent disk (PD) to your cloud compute in order to provide an option to keep the data on the disk after you delete your compute. PDs also act as a safeguard to protect your data in the case that something goes wrong with the compute.']),
          p(['A minimal cost per hour is associated with maintaining the disk even when the cloud compute is paused or deleted.']),
          p(['If you delete your cloud compute, but keep your PD, the PD will be reattached when creating the next cloud compute.']),
          h(Link, { href: 'https://support.terra.bio/hc/en-us/articles/360047318551', ...Utils.newTabLinkProps }, [
            'Learn more about persistent disks',
            icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })
          ])
        ])
      ])
    }

    const renderPackages = () => {
      return div({ style: styles.drawerContent }, [
        h(TitleBar, {
          id: titleId,
          style: styles.titleBar,
          title: 'Installed packages',
          hideCloseButton: isAnalysisMode,
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
    const { runtime: desiredRuntime } = this.getDesiredEnvironmentConfig()
    return desiredRuntime.cloudService === cloudServices.DATAPROC && this.hasAttachedDisk()
  }

  shouldUsePersistentDisk() {
    const { sparkMode, upgradeDiskSelected, currentRuntimeDetails } = this.state
    return !sparkMode && (!currentRuntimeDetails?.runtimeConfig.diskSize || upgradeDiskSelected)
  }

  willDeletePersistentDisk() {
    const { persistentDisk: existingPersistentDisk } = this.getExistingEnvironmentConfig()
    return existingPersistentDisk && !this.canUpdatePersistentDisk()
  }

  willDeleteBuiltinDisk() {
    const { runtime: existingRuntime } = this.getExistingEnvironmentConfig()
    return (existingRuntime?.diskSize || existingRuntime?.masterDiskSize) && !this.canUpdateRuntime()
  }

  willRequireDowntime() {
    const { runtime: existingRuntime } = this.getExistingEnvironmentConfig()
    return existingRuntime && (!this.canUpdateRuntime() || this.isStopRequired())
  }
}

NewRuntimeModalBase.defaultProps = {
  isAnalysisMode: false
}

export const NewRuntimeModal = withModalDrawer({ width: 675, 'aria-labelledby': titleId })(
  NewRuntimeModalBase
)
