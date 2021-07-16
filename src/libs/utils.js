import { isToday, isYesterday } from 'date-fns'
import { differenceInCalendarMonths } from 'date-fns/fp'
import _ from 'lodash/fp'
import * as qs from 'qs'
import { forwardRef, memo, useEffect, useRef, useState } from 'react'
import { div, h, span } from 'react-hyperscript-helpers'
import { v4 as uuid } from 'uuid'


export const subscribable = () => {
  let subscribers = []
  return {
    subscribe: fn => {
      subscribers = append(fn, subscribers)
      return {
        unsubscribe: () => {
          subscribers = _.without([fn], subscribers)
        }
      }
    },
    next: (...args) => {
      _.forEach(fn => fn(...args), subscribers)
    }
  }
}

/**
 * A simple state container inspired by clojure atoms. Method names were chosen based on similarity
 * to lodash and Immutable. (deref => get, reset! => set, swap! => update, reset to go back to initial value)
 * Implements the Store interface
 */
export const atom = initialValue => {
  let value = initialValue
  const { subscribe, next } = subscribable()
  const get = () => value
  const set = newValue => {
    const oldValue = value
    value = newValue
    next(newValue, oldValue)
  }
  return { subscribe, get, set, update: fn => set(fn(get())), reset: () => set(initialValue) }
}

/**
 * Hook that returns the value of a given store. When the store changes, the component will re-render
 */
export const useStore = theStore => {
  const [value, setValue] = useState(theStore.get())
  useEffect(() => {
    return theStore.subscribe(v => setValue(v)).unsubscribe
  }, [theStore, setValue])
  return value
}

export const withDisplayName = _.curry((name, WrappedComponent) => {
  WrappedComponent.displayName = name
  return WrappedComponent
})

export const forwardRefWithName = _.curry((name, WrappedComponent) => {
  return withDisplayName(name, forwardRef(WrappedComponent))
})

export const memoWithName = _.curry((name, WrappedComponent) => {
  return withDisplayName(name, memo(WrappedComponent))
})

/**
 * HOC that injects the value of the given store as a prop. When the store changes, the wrapped
 * component will re-render
 */
export const connectStore = (theStore, name) => WrappedComponent => {
  return withDisplayName('connectStore', props => {
    const value = useStore(theStore)
    return h(WrappedComponent, { ...props, [name]: value })
  })
}

const dateFormat = new Intl.DateTimeFormat('default', { day: 'numeric', month: 'short', year: 'numeric' })
const monthYearFormat = new Intl.DateTimeFormat('default', { month: 'short', year: 'numeric' })
const completeDateFormat = new Intl.DateTimeFormat('default', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: 'numeric' })
const completeDateFormatParts = [
  new Intl.DateTimeFormat('default', { day: 'numeric', month: 'short', year: 'numeric' }),
  new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric' })
]

export const makePrettyDate = dateString => {
  const date = new Date(dateString)

  return cond(
    [isToday(date), () => 'Today'],
    [isYesterday(date), () => 'Yesterday'],
    [differenceInCalendarMonths(date, Date.now()) <= 6, () => dateFormat.format(date)],
    () => monthYearFormat.format(date)
  )
}

export const makeStandardDate = dateString => dateFormat.format(new Date(dateString))

export const makeCompleteDate = dateString => completeDateFormat.format(new Date(dateString))

export const makeCompleteDateParts = dateString => {
  const date = new Date(dateString)
  return _.map(part => part.format(date), completeDateFormatParts)
}

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatUSD = v => cond(
  [_.isNaN(v), () => 'unknown'],
  [(v > 0) && (v < 0.01), () => '< $0.01'],
  () => usdFormatter.format(v)
)

export const formatNumber = new Intl.NumberFormat('en-US').format

export const workspaceAccessLevels = ['NO ACCESS', 'READER', 'WRITER', 'OWNER', 'PROJECT_OWNER']

export const hasAccessLevel = _.curry((required, current) => {
  return workspaceAccessLevels.indexOf(current) >= workspaceAccessLevels.indexOf(required)
})

export const canWrite = hasAccessLevel('WRITER')
export const canRead = hasAccessLevel('READER')
export const isOwner = hasAccessLevel('OWNER')

export const workflowStatuses = ['Queued', 'Launching', 'Submitted', 'Running', 'Aborting', 'Succeeded', 'Failed', 'Aborted']

export const log = (...args) => {
  console.log.apply(null, args)
  return _.last(args)
}

const maybeCall = maybeFn => _.isFunction(maybeFn) ? maybeFn() : maybeFn

/**
 * Takes any number of [predicate, value] pairs, followed by an optional default value.
 * Returns value() for the first truthy predicate, otherwise returns the default value().
 * Returns undefined if no predicate matches and there is no default value.
 *
 * DEPRECATED: If a value is not a function, it will be returned directly instead.
 * This behavior is deprecated, and will be removed in the future.
 */
export const cond = (...args) => {
  console.assert(_.every(arg => {
    return _.isFunction(arg) || (_.isArray(arg) && arg.length === 2 && _.isFunction(arg[1]))
  }, args), 'Invalid arguments to Utils.cond')
  for (const arg of args) {
    if (_.isArray(arg)) {
      const [predicate, value] = arg
      if (predicate) return maybeCall(value)
    } else {
      return maybeCall(arg)
    }
  }
}

export const DEFAULT = Symbol()

export const switchCase = (value, ...pairs) => {
  const match = _.find(([v]) => v === value || v === DEFAULT, pairs)
  return match && match[1]()
}

export const toIndexPairs = _.flow(_.toPairs, _.map(([k, v]) => [k * 1, v]))

/**
 * Memoizes an async function for up to `expires` ms.
 * Rejected promises are immediately removed from the cache.
 */
export const memoizeAsync = (asyncFn, { keyFn = _.identity, expires = Infinity }) => {
  const cache = {}
  return (...args) => {
    const now = Date.now()
    const key = keyFn(...args)
    const entry = cache[key]
    if (entry && now < entry.timestamp + expires) {
      return entry.value
    }
    const value = asyncFn(...args)
    cache[key] = { timestamp: now, value }
    value.catch(() => {
      if (cache[key] && cache[key].value === value) {
        delete cache[key]
      }
    })
    return value
  }
}

export const delay = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Returns a promise that will never resolve or reject. Useful for cancelling async flows.
export const abandonedPromise = () => {
  return new Promise(() => {})
}

export const generateRuntimeName = () => `saturn-${uuid()}`

export const generateGalaxyAppName = () => `saturn-k8-${uuid()}`

export const generatePersistentDiskName = () => `saturn-pd-${uuid()}`

export const waitOneTick = () => new Promise(setImmediate)

export const entityAttributeText = (value, machineReadable) => {
  return cond(
    [_.has('entityName', value), () => value.entityName],
    [_.has('items', value), () => {
      const isPlural = value.items.length !== 1
      const label = value.itemsType === 'EntityReference' ?
        isPlural ? 'entities' : 'entity' :
        isPlural ? 'items' : 'item'

      return machineReadable ?
        JSON.stringify(value.items) :
        `${value.items.length} ${label}`
    }],
    () => value
  )
}

// Returns a message explaining why the user can't edit the workspace, or undefined if they can
export const editWorkspaceError = ({ accessLevel, workspace: { isLocked } }) => {
  return cond(
    [!canWrite(accessLevel), () => 'You do not have permission to modify this workspace.'],
    [isLocked, () => 'This workspace is locked']
  )
}

// Returns a message explaining why the user can't compute in the workspace, or undefined if they can
export const computeWorkspaceError = ({ canCompute, workspace: { isLocked } }) => {
  return cond(
    [!canCompute, () => 'You do not have access to run analyses on this workspace.'],
    [isLocked, () => 'This workspace is locked']
  )
}

export const textMatch = _.curry((needle, haystack) => {
  return haystack.toLowerCase().includes(needle.toLowerCase())
})

export const nextSort = ({ field, direction }, newField) => {
  return newField === field ?
    { field, direction: direction === 'asc' ? 'desc' : 'asc' } :
    { field: newField, direction: 'asc' }
}

export const summarizeErrors = errors => {
  const errorList = cond(
    [_.isPlainObject(errors), () => _.flatMap(_.values, errors)],
    [_.isArray(errors), () => errors],
    () => []
  )
  if (errorList.length) {
    return _.map(([k, v]) => {
      return div({ key: k, style: { marginTop: k !== '0' ? '0.5rem' : undefined } }, [v])
    }, _.toPairs(errorList))
  }
}

export const readFileAsText = file => {
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/**
 * Returns true if a value can't be coerced into a number.
 */
export const cantBeNumber = _.flow(_.toNumber, _.isNaN)

/**
 * Converts a value to a type. Auto-curries.
 * @param {string} type - 'string', 'number', or 'boolean'
 * @param value
 */
export const convertValue = _.curry((type, value) => {
  switch (type) {
    case 'string':
      // known issue where toString is incorrectly flagged:
      // eslint-disable-next-line lodash-fp/preferred-alias
      return _.toString(value)
    case 'number':
      return _.toNumber(value)
    case 'boolean':
      return !['false', 'no', '0', ''].includes(_.lowerCase(value))
    default:
      throw new Error('unknown type for convertValue')
  }
})

/**
 * Converts a string to start case, for a label, but handles all caps correctly.
 */
export const normalizeLabel = _.flow(_.camelCase, _.startCase)

export const kvArrayToObject = _.reduce((acc, { key, value }) => _.set(key, value, acc), {})

export const isValidWsExportTarget = _.curry((sourceWs, destWs) => {
  const { workspace: { workspaceId: sourceId, authorizationDomain: sourceAD } } = sourceWs
  const { accessLevel, workspace: { workspaceId: destId, authorizationDomain: destAD } } = destWs

  return sourceId !== destId && canWrite(accessLevel) && (_.intersectionWith(_.isEqual, sourceAD, destAD).length === sourceAD.length)
})

export const append = _.curry((value, arr) => _.concat(arr, [value]))

// Transforms an async function so that it updates a busy flag via the provided callback
export const withBusyState = _.curry((setBusy, fn) => async (...args) => {
  try {
    setBusy(true)
    return await fn(...args)
  } finally {
    setBusy(false)
  }
})

/**
 * Performs the given effect, but only on component mount.
 * React's hooks eslint plugin flags [] because it's a common mistake. However, sometimes this is
 * exactly the right thing to do. This function makes the intention clear and avoids the lint error.
 */
export const useOnMount = fn => {
  useEffect(fn, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export const usePrevious = value => {
  const ref = useRef()

  useEffect(() => {
    ref.current = value
  })

  return ref.current
}

/*
 * Given a value that changes over time, returns a getter function that reads the current value.
 * Useful for asynchronous processes that need to read the current value of e.g. props or state.
 */
export const useGetter = value => {
  const ref = useRef()
  ref.current = value
  return () => ref.current
}

/*
 * Calls the provided function to produce and return a value tied to this component instance.
 * The initializer function is only called once for each component instance, on first render.
 */
export const useInstance = fn => {
  const ref = useRef()
  if (!ref.current) {
    ref.current = fn()
  }
  return ref.current
}

export const useUniqueId = () => {
  return useInstance(() => _.uniqueId('unique-id-'))
}

export const newTabLinkProps = { target: '_blank', rel: 'noopener noreferrer' } // https://mathiasbynens.github.io/rel-noopener/

export const newTabLinkPropsWithReferrer = { target: '_blank', rel: 'noopener' }

export const createHtmlElement = (doc, name, attrs) => {
  const element = doc.createElement(name)
  _.forEach(([k, v]) => element.setAttribute(k, v), _.toPairs(attrs))
  return element
}

export const mergeQueryParams = (params, urlString) => {
  const url = new URL(urlString)
  url.search = qs.stringify({ ...qs.parse(url.search, { ignoreQueryPrefix: true, plainObjects: true }), ...params })
  return url.href
}

export const durationToMillis = ({ hours = 0, minutes = 0, seconds = 0 }) => ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000

export const useConsoleAssert = (condition, message) => {
  const printed = useRef(false)
  if (!printed.current && !condition) {
    printed.current = true
    console.error(message) // Note: using error because assert halts execution
  }
}

/**
 * Asserts that a component has an accessible label, and alerts the developer how to fix it if it doesn't.
 *
 * @param componentName The name of the component, which will be printed to the console if there's an alert.
 * @param [allowLabelledBy] If true (default), the component can have an aria-labelledby linked to another element. Set to false to only allow aria-label.
 * @param [allowId] If true, the component can have an id linked to a label using htmlFor. This is true for form elements.
 * @param [allowTooltip] If true, the component can have a tooltip which will be used if needed as the label.
 * @param [allowContent] If true, the component can used nested textual content as its label, as long as it's not a single unlabelled icon
 * @param [ariaLabel] Optional: The label provided to the component
 * @param [ariaLabelledBy] Optional: The ID of the label provided to the component
 * @param [id]: Optional: The ID of the component if allowId is true
 * @param [tooltip] Optional: The tooltip provided to the component if allowTooltip is true
 */
export const useLabelAssert = (componentName, {
  allowLabelledBy = true, allowId = false, allowTooltip = false, allowContent = false,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, id, tooltip
}) => {
  const printed = useRef(false)

  if (!printed.current) {
    // Ensure that the properties contain a label
    if (!(ariaLabel ||
      (allowLabelledBy && ariaLabelledBy) ||
      (allowId && id) || (allowTooltip && tooltip)
    )) {
      printed.current = true

      console.warn(`For accessibility, ${componentName} needs a label. Resolve this by doing any of the following: ${allowContent ? `
  * add a child component with textual content or a label
  * if the child is an icon, add a label to it` : ''}${allowTooltip ? `
  * add a tooltip property to this component, which will also be used as the aria-label` : ''}
  * add an aria-label property to this component${allowLabelledBy ? `
  * add an aria-labelledby property referencing the id of another component containing the label` : ''}${allowId ? `
  * create a label component and point its htmlFor property to this component's id` : ''}`)
    }
  }
}

/**
 * Returns the aria-label to use for a component if applicable.
 *
 * If aria-label was provided, it will be returned
 * If aria-labelledby was provided, or an id was provided and allowId is true, then this will return nothing because the component is already labeled
 * If a tooltip was provided without any of the other attributes, it will be returned to be used as the aria-label
 */
export const getAriaLabelOrTooltip = ({ allowId = false, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, id, tooltip }) => {
  return (ariaLabel || ariaLabelledBy || (allowId && id)) ? ariaLabel : tooltip
}

export const useCancelable = () => {
  const [controller, setController] = useState(new window.AbortController())

  // Abort it automatically in the destructor
  useEffect(() => {
    return () => controller.abort()
  }, [controller])

  return {
    signal: controller.signal,
    abort: () => {
      controller.abort()
      setController(new window.AbortController())
    }
  }
}

export const useCancellation = () => {
  const controller = useRef()
  useOnMount(() => {
    const instance = controller.current
    return () => instance.abort()
  })
  if (!controller.current) {
    controller.current = new window.AbortController()
  }
  return controller.current.signal
}

export const withCancellationSignal = WrappedComponent => {
  return withDisplayName('withCancellationSignal', props => {
    const signal = useCancellation()
    return h(WrappedComponent, { ...props, signal })
  })
}

export const usePollingEffect = (effectFn, { ms, leading }) => {
  const signal = useCancellation()

  useOnMount(() => {
    const poll = async () => {
      leading && await effectFn()
      while (!signal.aborted) {
        await delay(ms)
        !signal.aborted && await effectFn()
      }
    }
    poll()
  })
}

export const useCurrentTime = (initialDelay = 250) => {
  const [currentTime, setCurrentTime] = useState(Date.now())
  const signal = useCancellation()
  const delayRef = useRef(initialDelay)
  useOnMount(() => {
    const poll = async () => {
      while (!signal.aborted) {
        await delay(delayRef.current)
        !signal.aborted && setCurrentTime(Date.now())
      }
    }
    poll()
  })
  return [currentTime, delay => { delayRef.current = delay }]
}

export const maybeParseJSON = maybeJSONString => {
  try {
    return JSON.parse(maybeJSONString)
  } catch {
    return undefined
  }
}

export const sanitizeEntityName = unsafe => unsafe.replace(/[^\w]/g, '-')

export const makeTSV = rows => {
  return _.join('', _.map(row => `${_.join('\t', row)}\n`, rows))
}

export const commaJoin = (list, conjunction = 'or') => {
  return span(_.flow(
    toIndexPairs,
    _.flatMap(([i, val]) => {
      return [(i === 0 ? '' : i === list.length - 1 ? ` ${conjunction} ` : ', '), val]
    })
  )(list))
}

export const sha256 = async message => {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
  return _.flow(
    _.map(v => v.toString(16).padStart(2, '0')),
    _.join('')
  )(new Uint8Array(hashBuffer))
}
