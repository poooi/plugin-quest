require('babel-register')({
  extensions: ['.es'],
  presets: ['es2017-node7', 'stage-0', 'react'],
  plugins: ['add-module-exports', 'closure-elimination'],
})

const fetch = require('node-fetch')
const fs = require('fs-extra')
const path = require('path')
const HttpsProxyAgent = require('https-proxy-agent')
const { map, fromPairs } = require('lodash')
const Promise = require('bluebird')
const generateReqstr = require('./reqstr.es')
const i18next = require('i18next')

const proxy = process.env.https_proxy || process.env.http_proxy || ''
const { local } = process.env
console.log(local)
if (proxy) {
  console.log('using proxy', proxy)
}

const LOCALES = ['zh-CN', 'zh-TW', 'ja-JP', 'en-US']

const initI18n = async () => {
  const res = await Promise.map(LOCALES, async locale => {
    const data = await fs.readJSON(
      path.resolve(__dirname, `./assets/i18n/${locale}.json`),
    )
    return [locale, { 'poi-plugin-quest-info': data }]
  })

  i18next.init({
    resources: fromPairs(res),
  })
}

const main = async () => {
  try {
    let content
    if (local) {
      content = await fs.readJSON(path.resolve(__dirname, './assets/data.json'))
      console.log('read from local file')
    } else {
      const resp = await fetch(
        'https://kcwikizh.github.io/kcdata/quest/poi.json',
        {
          agent: proxy ? new HttpsProxyAgent(proxy) : null,
        },
      )
      console.log('fetched')
      content = await resp.json()
      await fs.outputJSON(
        path.resolve(__dirname, './assets/data.json'),
        content,
        { spaces: 2 },
      )
    }

    await initI18n()

    await Promise.each(['zh-CN', 'zh-TW', 'ja-JP', 'en-US'], async lng => {
      const translate = i18next.getFixedT(lng, 'poi-plugin-quest-info')
      const reqstr = generateReqstr(translate, lng)
      const result = map(content, quest => {
        try {
          return [quest.game_id, reqstr(quest.requirements)]
        } catch (e) {
          return [quest.game_id, '']
        }
      })
      await fs.outputJSON(
        path.resolve(__dirname, `./result/${lng}.json`),
        fromPairs(result),
        { spaces: 2 },
      )
    })
  } catch (e) {
    console.warn(e, e.stack)
  }
}

main()
