/* eslint-disable import/prefer-default-export */
import i18next from 'i18next'
import { readI18nResources, escapeI18nKey } from 'views/utils/tools'

const format = JSON.stringify
export const addGlobalI18n = namespace => {
  window.i18n[namespace] = {
    fixedT: i18next.getFixedT(window.language, namespace),
  }

  window.i18n[namespace].__ = (str, ...args) =>
    format(window.i18n[namespace].fixedT(escapeI18nKey(str)), ...args)
  window.i18n[namespace].__n = (str, ...args) =>
    format(window.i18n[namespace].fixedT(escapeI18nKey(str)), ...args)
  window.i18n[namespace].setLocale = () => {}
}

export { readI18nResources }
