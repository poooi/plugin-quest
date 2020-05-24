/* eslint-disable import/prefer-default-export */

export function copyIfSame(obj, to) {
  // assert(typeof obj === 'object')
  if (obj === to) return Array.isArray(obj) ? obj.slice() : { ...obj }
  return obj
}
