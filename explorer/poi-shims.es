/* eslint-disable no-undef */
import I18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { createStore, combineReducers, applyMiddleware } from 'redux'
import * as path from 'path-extra'
import * as electron from 'electron'
import { reducer } from '../redux'

const EXTENSION_KEY = 'poi-plugin-quest-info'

const noop = () => {}

// redux
const logger = store => next => action => {
  console.log('dispatching', action)
  const result = next(action)
  console.log('next state', store.getState())
  return result
}

export const store = createStore(
  combineReducers({
    ext: combineReducers({
      [EXTENSION_KEY]: combineReducers({ _: reducer }),
    }),
  }),
  undefined,
  applyMiddleware(logger),
)
globalThis.store = store
globalThis.getStore = store.getState
globalThis.dispatch = (...args) => {
  console.log('[dispatch]', ...args)
  return store.dispatch(...args)
}

window.language = 'en-US'
// i18n
// const NS = [EXTENSION_KEY, 'resources']
const namespace = EXTENSION_KEY
const i18next = I18next.createInstance()
i18next.use(initReactI18next)
i18next.init({
  lng: window.language,
  fallbackLng: false,
  interpolation: {
    escapeValue: false,
  },
  returnObjects: true, // allow returning objects
  react: {
    wait: false,
    nsMode: 'fallback',
    usePureComponent: true,
  },
  // debug: true,
})

i18next.addResourceBundle(
  'zh-CN',
  namespace,
  require('../assets/i18n/zh-CN.json'),
  true,
  true,
)
i18next.addResourceBundle(
  'zh-TW',
  namespace,
  require('../assets/i18n/zh-TW.json'),
  true,
  true,
)
i18next.addResourceBundle(
  'ja-JP',
  namespace,
  require('../assets/i18n/ja-JP.json'),
  true,
  true,
)
i18next.addResourceBundle(
  'en-US',
  namespace,
  require('../assets/i18n/en-US.json'),
  true,
  true,
)

globalThis.i18next = i18next
// eslint-disable-next-line import/prefer-default-export
export { i18next }

// ipc
globalThis.ipc = {
  register: noop,
  unregister: noop,
}

const join = (...args) => args.join('/').slice(1)

path.join = join

const config = {
  addListener: noop,
  get: noop,
}

globalThis.config = config
globalThis.ROOT = ''

electron.shell = {}
electron.shell.openExternal = (...args) => window.open(...args)
