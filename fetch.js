require('babel-register')({
  extensions: ['.es'],
  presets: ['es2017-node7', 'stage-0', 'react'],
  plugins: [
    'add-module-exports',
    'closure-elimination',
  ],
})

const fetch = require('node-fetch')
const fs = require('fs-extra')
const path = require('path')
const HttpsProxyAgent = require('https-proxy-agent')
const { map, fromPairs } = require('lodash')
const Promise = require('bluebird')
const generateReqstr = require('./reqstr.es')
const i18n2 = require('i18n-2')


const proxy = process.env.https_proxy || process.env.http_proxy || ''
if (proxy) {
  console.log('using proxy', proxy)
}

const getTranslate = async (namespace) => {
  const locale = await fs.readJSON(path.resolve(__dirname, `./assets/i18n/${namespace}.json`))
  const i18n = new i18n2({
    locales: {
      [namespace]: locale,
    },
    defaultLocale: namespace,
    devMode: false,
  })
  return i18n.__.bind(i18n)
}

const main = async () => {
  try {
    const resp = await fetch('https://kcwikizh.github.io/kcdata/quest/poi.json', {
      agent: proxy ? new HttpsProxyAgent(proxy) : null,
    })
    console.log('fetched')
    const content = await resp.json()
    await fs.outputJSON(path.resolve(__dirname, './assets/data.json'), content, { spaces: 2 })

    await Promise.each(['zh-CN', 'zh-TW', 'ja-JP', 'en-US'], async (ns) => {
      const translate = await getTranslate(ns)
      const reqstr = generateReqstr(translate)
      const result = map(content, (quest) => {
        try {
          return [quest.game_id, reqstr(quest.requirements)]
        } catch (e) {
          return [quest.game_id, '']
        }
      })
      await fs.outputJSON(path.resolve(__dirname, `./result/${ns}.json`), fromPairs(result), { spaces: 2 })
    })
  } catch (e) {
    console.warn(e, e.stack)
  }
}

main()
