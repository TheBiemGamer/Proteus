/**
 * @file mhw.js
 * @description Proteus Mod Manager Plugin for Monster Hunter: World.
 * Features:
 * - Stracker's Loader validation and detection
 * - Standard NativePC mod installation
 */

module.exports.default = {
  id: 'mhw',
  name: 'Monster Hunter: World',
  version: '1.0.3',
  author: 'TheBiemGamer',
  modSources: [{ text: 'Nexus Mods', url: 'https://www.nexusmods.com/monsterhunterworld' }],
  executable: 'MonsterHunterWorld.exe',
  steamAppId: '582010',
  modFileExtensions: ['zip', 'rar', '7z', 'mod'],
  iconUrl: 'https://cdn2.steamgriddb.com/icon_thumb/c95d62c68196b2d0c1c1de8c7eeb6d50.png',
  theme: {
    accent: '30, 58, 138', // Deep Blue
    bgStart: '10, 15, 30'
  },

  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      const check = path.join(folder, 'Monster Hunter World', 'MonsterHunterWorld.exe')
      if (sandbox.manager.fileExists(check)) {
        return path.dirname(check)
      }
    }
    return null
  },

  prepareForModding: async (gamePath) => {
    const path = require('path')
    // Check for Stracker's Loader (dinput8.dll or loader.dll usually)
    const loaderCheck = path.join(gamePath, 'dinput8.dll')
    const loaderCheck2 = path.join(gamePath, 'loader.dll')

    if (!sandbox.manager.fileExists(loaderCheck) && !sandbox.manager.fileExists(loaderCheck2)) {
      sandbox.console.log("Stracker's Loader not found.")
      // Alert removed by request - reliant on banner only
    } else {
      sandbox.console.log("Stracker's Loader detected.")
    }
  },
  checkRequirements: async (gamePath) => {
    const path = require('path')
    const loaderCheck = path.join(gamePath, 'dinput8.dll')
    const loaderCheck2 = path.join(gamePath, 'loader.dll')

    // Return true if loader exists, false if missing
    if (sandbox.manager.fileExists(loaderCheck) || sandbox.manager.fileExists(loaderCheck2)) {
      return { valid: true }
    }

    return {
      valid: false,
      message: "Stracker's Loader is missing. Mods will not load without it.",
      link: 'https://www.nexusmods.com/monsterhunterworld/mods/1982',
      linkText: "Download Stracker's Loader"
    }
  },
  install: async (sourcePath, gamePath, originalZipPath) => {
    const path = require('path')
    sandbox.console.log(`Deploying from ${sourcePath}...`)

    const hasLoader = sandbox.manager.fileExists(path.join(sourcePath, 'dinput8.dll'))
    const hasNativePC = sandbox.manager.isDirectory(path.join(sourcePath, 'nativePC'))

    let installRoot
    if (hasLoader) {
      sandbox.console.log('>> Installing Loader (Root)')
      installRoot = gamePath
    } else if (hasNativePC) {
      sandbox.console.log('>> Installing Mod with nativePC structure (Root)')
      installRoot = gamePath
    } else {
      sandbox.console.log('>> Installing Mod loose files (nativePC)')
      installRoot = path.join(gamePath, 'nativePC')
    }

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

    deployRecursive(sourcePath, installRoot)
    return true
  }
}
