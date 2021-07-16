import _ from 'lodash/fp'
import { Fragment } from 'react'
import { div, h, input, label } from 'react-hyperscript-helpers'
import { IdContainer } from 'src/components/common'
import { cloudServices, dataprocCpuPrice, ephemeralExternalIpAddressPrice, machineTypes, monthlyStoragePrice, storagePrice } from 'src/data/machines'
import colors from 'src/libs/colors'
import * as Style from 'src/libs/style'
import * as Utils from 'src/libs/utils'


export const DEFAULT_DISK_SIZE = 50
export const DEFAULT_BOOT_DISK_SIZE = 50

export const usableStatuses = ['Updating', 'Running']

export const defaultDataprocMachineType = 'n1-standard-2'
export const defaultGceMachineType = 'n1-standard-1'
export const getDefaultMachineType = isDataproc => isDataproc ? defaultDataprocMachineType : defaultGceMachineType

export const normalizeRuntimeConfig = ({
  cloudService, machineType, diskSize, masterMachineType, masterDiskSize, numberOfWorkers,
  numberOfPreemptibleWorkers, workerMachineType, workerDiskSize, bootDiskSize
}) => {
  const isDataproc = cloudService === cloudServices.DATAPROC

  return {
    cloudService: cloudService || cloudServices.GCE,
    masterMachineType: masterMachineType || machineType || getDefaultMachineType(isDataproc),
    masterDiskSize: masterDiskSize || diskSize || DEFAULT_DISK_SIZE,
    numberOfWorkers: (isDataproc && numberOfWorkers) || 0,
    numberOfPreemptibleWorkers: (isDataproc && numberOfWorkers && numberOfPreemptibleWorkers) || 0,
    workerMachineType: (isDataproc && numberOfWorkers && workerMachineType) || defaultDataprocMachineType,
    workerDiskSize: (isDataproc && numberOfWorkers && workerDiskSize) || DEFAULT_DISK_SIZE,
    // One caveact with using DEFAULT_BOOT_DISK_SIZE here is this over-estimates old GCE runtimes without PD by 1 cent
    // because those runtimes do not have a separate boot disk. But those old GCE runtimes are more than 1 year old if they exist.
    // Hence, we're okay with this caveat.
    bootDiskSize: bootDiskSize || DEFAULT_BOOT_DISK_SIZE
  }
}

export const findMachineType = name => {
  return _.find({ name }, machineTypes) || { name, cpu: '?', memory: '?', price: NaN, preemptiblePrice: NaN }
}

const dataprocCost = (machineType, numInstances) => {
  const { cpu: cpuPrice } = findMachineType(machineType)

  return cpuPrice * numInstances * dataprocCpuPrice
}

export const runtimeConfigBaseCost = config => {
  const {
    cloudService, masterMachineType, masterDiskSize, numberOfWorkers, workerMachineType, workerDiskSize, bootDiskSize
  } = normalizeRuntimeConfig(
    config)

  return _.sum([
    (masterDiskSize + numberOfWorkers * workerDiskSize) * storagePrice,
    cloudService === cloudServices.DATAPROC && (dataprocCost(masterMachineType, 1) + dataprocCost(workerMachineType, numberOfWorkers)),
    bootDiskSize * storagePrice
  ])
}

export const runtimeConfigCost = config => {
  const { cloudService, masterMachineType, numberOfWorkers, numberOfPreemptibleWorkers, workerMachineType, workerDiskSize } = normalizeRuntimeConfig(
    config)
  const { price: masterPrice } = findMachineType(masterMachineType)
  const { price: workerPrice, preemptiblePrice } = findMachineType(workerMachineType)
  const numberOfStandardVms = 1 + numberOfWorkers // 1 is for the master VM

  return _.sum([
    masterPrice,
    numberOfWorkers * workerPrice,
    numberOfPreemptibleWorkers * preemptiblePrice,
    numberOfPreemptibleWorkers * workerDiskSize * storagePrice,
    cloudService === cloudServices.DATAPROC && dataprocCost(workerMachineType, numberOfPreemptibleWorkers),
    ephemeralExternalIpAddressCost({ numStandardVms: numberOfStandardVms, numPreemptibleVms: numberOfPreemptibleWorkers }),
    runtimeConfigBaseCost(config)
  ])
}

const generateDiskCostFunction = price => ({ size, status }) => {
  return _.includes(status, ['Deleting', 'Failed']) ? 0.0 : size * price
}
export const persistentDiskCost = generateDiskCostFunction(storagePrice)
export const persistentDiskCostMonthly = generateDiskCostFunction(monthlyStoragePrice)

const ephemeralExternalIpAddressCost = ({ numStandardVms, numPreemptibleVms }) => {
  // Google categorizes a VM as 'standard' if it is not 'pre-emptible'.
  return numStandardVms * ephemeralExternalIpAddressPrice.standard + numPreemptibleVms * ephemeralExternalIpAddressPrice.preemptible
}

export const runtimeCost = ({ runtimeConfig, status }) => {
  switch (status) {
    case 'Stopped':
      return runtimeConfigBaseCost(runtimeConfig)
    case 'Deleting':
    case 'Error':
      return 0.0
    default:
      return runtimeConfigCost(runtimeConfig)
  }
}

export const getGalaxyCost = (app, dataDiskSize) => {
  return getGalaxyDiskCost(dataDiskSize) + getGalaxyComputeCost(app)
}

/*
 * - Default nodepool VMs always run and incur compute and external IP cost whereas app
 *   nodepool VMs incur compute and external IP cost only when an app is running.
 * - Default nodepool cost is shared across all Kubernetes cluster users. It would
 *   be complicated to calculate that shared cost dynamically. Therefore, we are being
 *   conservative by adding default nodepool cost to all apps on a cluster.
 */
export const getGalaxyComputeCost = app => {
  const appStatus = app?.status?.toUpperCase()
  const defaultNodepoolComputeCost = machineCost('n1-standard-1')
  const defaultNodepoolIpAddressCost = ephemeralExternalIpAddressCost({ numStandardVms: 1, numPreemptibleVms: 0 })

  const staticCost = defaultNodepoolComputeCost + defaultNodepoolIpAddressCost
  const dynamicCost = app.kubernetesRuntimeConfig.numNodes * machineCost(app.kubernetesRuntimeConfig.machineType) + ephemeralExternalIpAddressCost({ numStandardVms: app.kubernetesRuntimeConfig.numNodes, numPreemptibleVms: 0 })

  switch (appStatus) {
    case 'STOPPED':
      return staticCost
    case 'DELETING':
    case 'ERROR':
      return 0.0
    default:
      return staticCost + dynamicCost
  }
}

/*
 * - Disk cost is incurred regardless of app status.
 * - Disk cost is total for data (NFS) disk, metadata (postgres) disk, and boot disks (1 boot disk per nodepool)
 * - Size of a data disk is user-customizable. The other disks have fixed sizes.
 */
export const getGalaxyDiskCost = dataDiskSize => {
  const metadataDiskSize = 10 // GB
  const defaultNodepoolBootDiskSize = 100 // GB
  const appNodepoolBootDiskSize = 100 // GB

  return persistentDiskCost({
    status: 'Running',
    size: dataDiskSize + metadataDiskSize + defaultNodepoolBootDiskSize + appNodepoolBootDiskSize
  })
}

export const trimRuntimesOldestFirst = _.flow(
  _.remove({ status: 'Deleting' }),
  _.sortBy('auditInfo.createdDate')
)

export const getCurrentRuntime = runtimes => {
  // Status note: undefined means still loading, null means no runtime
  return !runtimes ? undefined : (_.flow(trimRuntimesOldestFirst, _.last)(runtimes) || null)
}

export const trimAppsOldestFirst = _.flow(
  _.remove({ status: 'DELETING' }),
  _.remove({ status: 'PREDELETING' }),
  _.sortBy('auditInfo.createdDate'))

export const machineCost = machineType => {
  return _.find(knownMachineType => knownMachineType.name === machineType, machineTypes).price
}

export const getCurrentApp = _.flow(trimAppsOldestFirst, _.last)

export const currentAppIncludingDeleting = _.flow(_.sortBy('auditInfo.createdDate'), _.last)

export const currentAttachedDataDisk = (app, galaxyDataDisks) => {
  return _.find({ name: app?.diskName }, galaxyDataDisks)
}

export const appIsSettingUp = app => {
  return app && (app.status === 'PROVISIONING' || app.status === 'PRECREATING')
}

export const currentPersistentDisk = (apps, galaxyDataDisks) => {
  // a user's PD can either be attached to their current app, detaching from a deleting app or unattached
  const currentGalaxyApp = currentAppIncludingDeleting(apps)
  const currentDataDiskName = currentGalaxyApp?.diskName
  const attachedDataDiskNames = _.without([undefined], _.map(app => app.diskName, apps))
  // if the disk is attached to an app (or being detached from a deleting app), return that disk. otherwise,
  // return the newest galaxy disk that the user has unattached to an app
  return currentDataDiskName ?
    _.find({ name: currentDataDiskName }, galaxyDataDisks) :
    _.last(_.sortBy('auditInfo.createdDate', _.filter(({ name, status }) => status !== 'Deleting' && !_.includes(name, attachedDataDiskNames), galaxyDataDisks)))
}

export const isCurrentGalaxyDiskDetaching = apps => {
  const currentGalaxyApp = currentAppIncludingDeleting(apps)
  return currentGalaxyApp && _.includes(currentGalaxyApp.status, ['DELETING', 'PREDELETING'])
}

export const getGalaxyCostTextChildren = (app, galaxyDataDisks) => {
  const dataDisk = currentAttachedDataDisk(app, galaxyDataDisks)
  return app ?
    [getConvertedAppStatus(app.status), dataDisk?.size ? ` (${Utils.formatUSD(getGalaxyCost(app, dataDisk.size))} / hr)` : ``] : ['None']
}

export const getConvertedRuntimeStatus = runtime => {
  return runtime && (runtime.patchInProgress ? 'LeoReconfiguring' : runtime.status) // NOTE: preserves null vs undefined
}

export const isAppDeletable = app => _.includes(app?.status, ['RUNNING', 'ERROR'])

export const getConvertedAppStatus = appStatus => {
  return Utils.switchCase(_.upperCase(appStatus),
    ['STOPPED', () => 'Paused'],
    ['STOPPING', () => 'Pausing'],
    ['STARTING', () => 'Resuming'],
    ['PRESTARTING', () => 'Starting'],
    ['PRESTOPPING', () => 'Stopping'],
    [Utils.DEFAULT, () => _.capitalize(appStatus)]
  )
}

export const RadioBlock = ({ labelText, children, name, checked, onChange, style = {} }) => {
  return div({
    style: {
      backgroundColor: colors.warning(0.2),
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

export const getIsAppBusy = app => app?.status !== 'RUNNING' && _.includes('ING', app?.status)
export const getIsRuntimeBusy = runtime => runtime?.status !== 'Running' && _.includes('ing', runtime?.status)

