import _ from 'lodash/fp'
import { Fragment, useRef, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { requesterPaysWrapper } from 'src/components/bucket-utils'
import { Link } from 'src/components/common'
import { getUserProjectForWorkspace, parseGsUri } from 'src/components/data/data-utils'
import { centeredSpinner, icon } from 'src/components/icons'
import { Ajax, saToken } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportError } from 'src/libs/error'
import { knownBucketRequesterPaysStatuses, requesterPaysProjectStore } from 'src/libs/state'
import * as Utils from 'src/libs/utils'

// format for selectedFiles prop: [{ filePath, indexFilePath } }]
const IGVBrowser = _.flow(
  Utils.withDisplayName('IGVBrowser'),
  requesterPaysWrapper({ onDismiss: ({ onDismiss }) => onDismiss() })
)(({ selectedFiles, refGenome, workspace, onDismiss, onRequesterPaysError }) => {
  const containerRef = useRef()
  const signal = Utils.useCancellation()
  const [loadingIgv, setLoadingIgv] = useState(true)

  Utils.useOnMount(() => {
    const igvSetup = async () => {
      const fileBucketExemplars = _.uniqBy(({ filePath }) => /gs:\/\/([^/]+)/.exec(filePath)[1], selectedFiles)

      // make sure any requester pays buckets get tagged, non-rp errors can be handled later for now
      const bucketRpStatuses = await Promise.all(_.map(async ({ filePath }) => {
        const [bucket, file] = parseGsUri(filePath)
        const knownBucketStatus = knownBucketRequesterPaysStatuses.get()[bucket]

        if (knownBucketStatus !== undefined) {
          return knownBucketStatus
        } else {
          try {
            await Ajax(signal).Buckets.getObject(bucket, file, workspace.workspace.namespace, { fields: 'kind' })
            return false
          } catch (e) {
            if (e.requesterPaysError) {
              return true
            }
          }
        }
      }, fileBucketExemplars))

      if (!requesterPaysProjectStore.get() && _.some(_.identity, bucketRpStatuses)) {
        onRequesterPaysError()
      } else {
        try {
          const { default: igv } = await import('igv')

          const options = {
            genome: refGenome,
            tracks: await Promise.all(_.map(async ({ filePath, indexFilePath }) => {
              const [bucket] = parseGsUri(filePath)
              const userProjectParam = { userProject: knownBucketRequesterPaysStatuses.get()[bucket] ? await getUserProjectForWorkspace(workspace) : undefined }

              return {
                name: `${_.last(filePath.split('/'))} (${filePath})`,
                url: Utils.mergeQueryParams(userProjectParam, filePath),
                indexURL: Utils.mergeQueryParams(userProjectParam, indexFilePath)
              }
            }, selectedFiles))
          }

          igv.setGoogleOauthToken(() => saToken(workspace.workspace.namespace))
          igv.createBrowser(containerRef.current, options)
        } catch (e) {
          reportError('Error loading IGV.js', e)
        } finally {
          setLoadingIgv(false)
        }
      }
    }

    igvSetup()
  })


  return h(Fragment, [
    h(Link, {
      onClick: onDismiss,
      style: { alignSelf: 'flex-start', display: 'flex', alignItems: 'center', padding: '6.5px 8px' }
    }, [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Back to data table']),
    div({
      ref: containerRef,
      style: {
        padding: '10px 0',
        margin: 8,
        border: `1px solid ${colors.dark(0.25)}`
      }
    }, [
      loadingIgv && centeredSpinner()
    ])
  ])
})

export default IGVBrowser
