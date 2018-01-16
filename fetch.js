const fetch = require('node-fetch')
const fs = require('fs-extra')
const path = require('path')
const HttpsProxyAgent = require('https-proxy-agent')

const proxy = process.env.https_proxy || process.env.http_proxy || ''
if (proxy) {
  console.log('using proxy', proxy)
}

const main = async () => {
  try {
    const resp = await fetch('https://kcwikizh.github.io/kcdata/quest/poi.json', {
      agent: proxy ? new HttpsProxyAgent(proxy) : null,
    })
    console.log('fetched')
    const content = await resp.json()
    await fs.outputJSON(path.resolve(__dirname, './assets/data.json'), content, { spaces: 2 })
  } catch (e) {
    console.warn(e, e.stack)
  }
}

main()
