module.exports = {
  local: {
    billingProject: 'saturn-integration-test-dev',
    dataRepoUrl: 'https://jade.datarepo-dev.broadinstitute.org',
    snapshotColumnName: 'name',
    snapshotId: 'f90f5d7f-c507-4e56-abfc-b965a66023fb',
    snapshotTableName: 'tableA',
    testUrl: 'http://localhost:3000',
    workflowName: 'echo_to_file'
  },
  dev: {
    billingProject: 'saturn-integration-test-dev',
    dataRepoUrl: 'https://jade.datarepo-dev.broadinstitute.org',
    snapshotColumnName: 'name',
    snapshotId: 'f90f5d7f-c507-4e56-abfc-b965a66023fb',
    snapshotTableName: 'tableA',
    testUrl: 'https://bvdp-saturn-dev.appspot.com',
    workflowName: 'echo_to_file'
  },
  alpha: {
    billingProject: 'saturn-integration-test-alpha',
    dataRepoUrl: 'https://data.alpha.envs-terra.bio',
    snapshotColumnName: 'VCF_File_Name',
    snapshotId: 'd56f4db5-b6c6-4a7e-8be2-ff6aa21c4fa6',
    snapshotTableName: 'vcf_file',
    testUrl: 'https://bvdp-saturn-alpha.appspot.com',
    workflowName: 'echo_to_file'
  },
  perf: {
    billingProject: 'saturn-integration-test-perf',
    dataRepoUrl: 'https://jade-perf.datarepo-perf.broadinstitute.org',
    snapshotColumnName: '',
    snapshotId: '',
    snapshotTableName: '',
    testUrl: 'https://bvdp-saturn-perf.appspot.com',
    workflowName: 'echo_to_file'
  },
  staging: {
    billingProject: 'saturn-integration-test-stage',
    dataRepoUrl: 'https://data.staging.envs-terra.bio',
    snapshotColumnName: '',
    snapshotId: '3e858a77-ea11-4f55-96f4-e6e45b71b7bf',
    snapshotTableName: '',
    testUrl: 'https://bvdp-saturn-staging.appspot.com',
    workflowName: 'echo_to_file'
  }
}
