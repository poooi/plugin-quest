// this requires node^7.6

const fetch = require('node-fetch')
const fs = require('fs-extra')
const path = require('path')

const main = async () => {
  try {
    const resp = await fetch('https://kcwikizh.github.io/kcdata/quest/poi.json')
    const content = await resp.json()
    await fs.outputJSON(path.resolve(__dirname, './assets/info/index.json'), content, { spaces: 2 })
  } catch (e) {
    console.warn(e, e.stack)
  }
}

main()
