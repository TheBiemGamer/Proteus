module.exports.default = {
  id: 'mhw',
  name: 'Monster Hunter: World',
  modSources: [{ text: 'Nexus Mods', url: 'https://www.nexusmods.com/monsterhunterworld' }],
  executable: 'MonsterHunterWorld.exe',
  steamAppId: '582010',
  modFileExtensions: ['zip', 'rar', '7z', 'mod'],

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
      await sandbox.manager.showAlert(
        "Stracker's Loader Required",
        "Monster Hunter World mods require Stracker's Loader to function correctly.\n\nPlease download and install it from Nexus Mods."
      )
      await sandbox.manager.openUrl('https://www.nexusmods.com/monsterhunterworld/mods/1982')
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
