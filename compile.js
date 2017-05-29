const walk = require('walk')
const Promise = require('bluebird')
const path = require('path')
const fs = require('fs-extra')
const babel = Promise.promisifyAll(require('babel-core'))

const changeExt = (srcPath, ext) => {
  const srcDir = path.dirname(srcPath)
  const srcBasename = path.basename(srcPath, path.extname(srcPath))
  return path.join(srcDir, srcBasename + ext)
}

const compileToJsAsync = (appDir, dontRemove) => {
  const targetExts = ['.es']

  const options = {
    followLinks: false,
    filters: ['node_modules', 'assets'],
  }

  const { presets, plugins } = require('./babel.config')

  return new Promise((resolve) => {
    const tasks = []
    walk.walk(appDir, options)
    .on('file', (root, fileStats, next) => {
      const extname = path.extname(fileStats.name).toLowerCase()
      if (targetExts.includes(extname)) {
        tasks.push(async () => {
          const srcPath = path.join(root, fileStats.name)
          console.log(srcPath)
          const tgtPath = changeExt(srcPath, '.js')
          let tgt
          try {
            const result = await babel.transformFileAsync(srcPath, {
              presets: presets.map(p => require.resolve(`babel-preset-${p}`)),
              plugins: plugins.map(p => require.resolve(`babel-plugin-${p}`)),
            })
            tgt = result.code
          } catch (e) {
            return
          }
          await fs.writeFile(tgtPath, tgt)
          if (!dontRemove) {
            await fs.remove(srcPath)
          }
        })
      }
      next()
    })
    .on('end', async () => {
      resolve(await Promise.all(tasks.map(f => f())))
    })
  })
}

const main = async () => {
  console.log(__dirname)
  await compileToJsAsync(__dirname)
}

main()
