import _ from 'lodash/fp'
import { machineTypes, storagePrice } from 'src/data/clusters'


export const normalizeMachineConfig = ({ masterMachineType, masterDiskSize, numberOfWorkers, numberOfPreemptibleWorkers, workerMachineType, workerDiskSize }) => {
  return {
    masterMachineType: masterMachineType || 'n1-standard-4',
    masterDiskSize: masterDiskSize || 50,
    numberOfWorkers: numberOfWorkers || 0,
    numberOfPreemptibleWorkers: (numberOfWorkers && numberOfPreemptibleWorkers) || 0,
    workerMachineType: (numberOfWorkers && workerMachineType) || 'n1-standard-4',
    workerDiskSize: (numberOfWorkers && workerDiskSize) || 50
  }
}

export const machineStorageCost = config => {
  const { masterDiskSize, numberOfWorkers, workerDiskSize } = normalizeMachineConfig(config)
  return (masterDiskSize + numberOfWorkers * workerDiskSize) * storagePrice
}

export const machineConfigCost = config => {
  const { masterMachineType, numberOfWorkers, numberOfPreemptibleWorkers, workerMachineType } = normalizeMachineConfig(config)
  const { price: masterPrice } = _.find({ name: masterMachineType }, machineTypes)
  const { price: workerPrice, preemptiblePrice } = _.find({ name: workerMachineType }, machineTypes)
  return _.sum([
    masterPrice,
    (numberOfWorkers - numberOfPreemptibleWorkers) * workerPrice,
    numberOfPreemptibleWorkers * preemptiblePrice,
    machineStorageCost(config)
  ])
}

export const clusterCost = ({ machineConfig, status }) => {
  switch (status) {
    case 'Stopped':
      return machineStorageCost(machineConfig)
    case 'Deleting':
    case 'Error':
      return 0.0
    default:
      return machineConfigCost(machineConfig)
  }
}
