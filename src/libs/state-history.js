import _ from 'lodash/fp'
import { getDynamic, removeDynamic, setDynamic } from 'src/libs/browser-storage'
import uuid from 'uuid/v4'


const getKey = () => {
  const state = window.history.state
  if (state && state.key) {
    return state.key
  } else {
    const key = uuid()
    window.history.replaceState({ key }, '')
    return key
  }
}


export const get = () => {
  const data = getDynamic(sessionStorage, getKey())
  return _.isPlainObject(data) ? data : {}
}

export const set = newState => {
  return setDynamic(sessionStorage, getKey(), newState)
}

export const update = newState => { set({ ...get(), ...newState }) }

export const clearCurrent = () => removeDynamic(sessionStorage, getKey())
