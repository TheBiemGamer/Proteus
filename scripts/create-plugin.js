const fs = require('fs')
const path = require('path')

const id = process.argv[2]
if (!id) {
  console.error('Missing game ID. Usage: task plugin <game_id>')
  process.exit(1)
}

const filePath = path.join('plugins', id + '.js')

const template = `module.exports.default = {
  id: '${id}',
  name: '${id.charAt(0).toUpperCase() + id.slice(1)}',
  version: '1.0.0',
  author: 'YourName',
  steamAppId: '000000',
  executable: 'bin/game.exe',

  modSources: [
    { text: 'Nexus Mods', url: 'https://www.nexusmods.com/${id}' }
  ],

  modFileExtensions: ['zip', 'rar', '7z'],
  iconUrl: '', // SteamGridDB or other URL
  theme: {
    accent: '168, 85, 247',
    bgStart: '20, 10, 30'
  },

  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      const check = path.join(folder, 'Game Folder', 'bin', 'game.exe')
      if (sandbox.manager.fileExists(check)) {
        return path.join(folder, 'Game Folder')
      }
    }
    return null
  },

  prepareForModding: async (gamePath) => {
    sandbox.console.log('Preparing ' + '${id}' + '...')
  },

  install: async (sourcePath, gamePath, originalZipPath) => {
    const path = require('path')

    const deployRecursive = (src, dest) => {
      const items = sandbox.manager.readDir(src)
      items.forEach((item) => {
        const srcItem = path.join(src, item)
        const destItem = path.join(dest, item)

        if (sandbox.manager.isDirectory(srcItem)) {
          deployRecursive(srcItem, destItem)
        } else {
          sandbox.manager.symlinkFile(srcItem, destItem)
        }
      })
    }

    deployRecursive(sourcePath, gamePath)
    return true
  }
};`

if (fs.existsSync(filePath)) {
  console.error('Plugin file already exists:', filePath)
  process.exit(1)
}

fs.writeFileSync(filePath, template)
console.log('Created plugin:', filePath)
