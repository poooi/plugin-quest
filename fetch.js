require('@babel/register')(require('poi-util-transpile/babel.config.js'))

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
    const pluginData = await fs.readJSON(
      path.resolve(__dirname, `./assets/i18n/${locale}.json`),
    )
    const resources = await fs.readJSON(
      path.resolve(__dirname, `./resources/${locale}.json`),
    )
    return [locale, { resources, 'poi-plugin-quest-info': pluginData }]
  })

  i18next.init({
    resources: fromPairs(res),
  })
}

const fetchResource = () =>
  Promise.map(LOCALES, async locale => {
    const resp = await fetch(
      `https://raw.githubusercontent.com/poooi/plugin-translator/master/i18n/${locale}.json`,
      {
        agent: proxy ? new HttpsProxyAgent(proxy) : null,
      },
    )
    console.log('fetched resource')
    const content = await resp.json()
    await fs.outputJSON(
      path.resolve(__dirname, `./resources/${locale}.json`),
      content,
      { spaces: 2 },
    )
  })

const dataSources = [
  {
    source: 'https://kcwikizh.github.io/kcdata/quest/poi.json',
    file: 'data',
    keep: true,
  },
  {
    source:
      'https://raw.githubusercontent.com/KC3Kai/kc3-translations/master/data/en/quests.json',
    file: 'KC3Kai',
    keep: false,
  },
]

const fixKC3KaiString = s => {
  const r = s
    .replace(/[^\x00-\x7F]/g, '') // eslint-disable-line no-control-regex
    .replace(/\s?Press F10 to clear the overlay\.?/g, '')
    .replace(/\s?Overlay: F10\.?/g, '')
    .replace(/\s?F10 will clear the overlay\.?/g, '')
  if (r.match(/overlay/i)) {
    console.log(`KC3Kai string unfixed: ${s}`)
  }
  return r
}

const main = async () => {
  try {
    const [content, contentKC3Kai] = await Promise.map(
      dataSources,
      async ({ source, file, keep }) => {
        let data
        if (local && keep) {
          data = await fs.readJSON(
            path.resolve(__dirname, `./assets/${file}.json`),
          )
          console.log(`${file} read from local file`)
        } else {
          const resp = await fetch(source, {
            agent: proxy ? new HttpsProxyAgent(proxy) : null,
          })
          data = await resp.json()
          console.log(`${file} fetched`)
          if (keep) {
            fs.outputJSON(
              path.resolve(__dirname, `./assets/${file}.json`),
              data,
              {
                spaces: 2,
              },
            )
          }
        }
        return data
      },
    )

    Object.keys(contentKC3Kai).forEach(no => {
      const id = parseInt(no, 10)
      const quest = content.find(e => e.game_id === id)
      const { code, name, desc, memo } = contentKC3Kai[no]
      if (quest) {
        quest.code = code
        quest.title = name
        quest.desc = desc && fixKC3KaiString(desc)
        quest.memo = memo && fixKC3KaiString(memo)
      } else {
        console.log(`KC3Kai only quest: ${id} ${code} ${name}`)
        content.push({
          code,
          title: name,
          desc: desc && fixKC3KaiString(desc),
          memo: memo && fixKC3KaiString(memo),
          game_id: id,
        })
      }
    })
    console.log(`KC3Kai data merged`)
    fs.outputJSON(path.resolve(__dirname, `./assets/data.json`), content, {
      spaces: 2,
    })

    await fetchResource()
    await initI18n()

    await Promise.each(['zh-CN', 'zh-TW', 'ja-JP', 'en-US'], async lng => {
      const translate = i18next.getFixedT(lng, [
        'poi-plugin-quest-info',
        'resources',
      ])
      const reqstr = generateReqstr(translate, lng)
      const result = map(content, quest => {
        try {
          return [quest.game_id, reqstr(quest.requirements || quest.desc)]
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
