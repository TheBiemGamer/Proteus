module.exports.default = {
  id: 'mhw',
  name: 'Monster Hunter: World',
  executable: 'MonsterHunterWorld.exe',
  steamAppId: '582010',

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
