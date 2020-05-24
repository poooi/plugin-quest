/* eslint-disable import/prefer-default-export */
import _, { isString } from 'lodash'
import { readJsonSync } from 'fs-extra'

export function copyIfSame(obj, to) {
  // assert(typeof obj === 'object')
  if (obj === to) return Array.isArray(obj) ? obj.slice() : { ...obj }
  return obj
}

const ensureString = str => (isString(str) ? str : toString(str))
const escapeI18nKey = str =>
  ensureString(str)
    .replace(/\.\W/g, '')
    .replace(/\.$/, '')
    .replace(/:\s/g, '')
    .replace(/:$/g, '')

export const readI18nResources = filePath => {
  try {
    let data = readJsonSync(filePath)
    data = _(data)
      .entries()
      .map(([key, v]) => [escapeI18nKey(key), v])
      .fromPairs()
      .value()
    return data
  } catch (e) {
    return {}
  }
}
