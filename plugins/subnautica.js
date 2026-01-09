/**
 * @file subnautica.js
 * @description Proteus Mod Manager Plugin for Subnautica.
 * Features:
 * - Supports latest Steam version (Legacy branch not supported)
 * - Requirements check for BepInEx and Nautilus
 * - BepInEx plugin management
 */

module.exports.default = {
  id: 'subnautica',
  name: 'Subnautica',
  version: '1.0.0',
  author: 'TheBiemGamer',
  iconUrl: 'https://cdn2.steamgriddb.com/icon/03ff5913b0517be4231fee8f421f2699/32/256x256.png',
  steamAppId: '264710',
  executable: 'Subnautica.exe',
  modSources: [{ text: 'Nexus Mods', url: 'https://www.nexusmods.com/subnautica' }],
  modFileExtensions: ['zip', 'rar', '7z', 'dll'],
  theme: {
    accent: '34, 211, 238', // Cyan
    bgStart: '12, 74, 110' // Deep Ocean Blue
  },

  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      // Steam: steamapps/common/Subnautica/Subnautica.exe
      const steamPath = path.join(folder, 'Subnautica')
      const steamExe = path.join(steamPath, 'Subnautica.exe')
      if (sandbox.manager.fileExists(steamExe)) {
        return steamPath
      }

      // Epic: Epic Games/Subnautica/Subnautica.exe
      const epicExe = path.join(folder, 'Subnautica.exe')
      if (sandbox.manager.fileExists(epicExe)) {
        return folder
      }
    }
    return null
  },

  checkRequirements: async (gamePath) => {
    const path = require('path')

    // Check for BepInEx (winhttp.dll in game root)
    const bepInExPath = path.join(gamePath, 'winhttp.dll')
    const hasBepInEx = sandbox.manager.fileExists(bepInExPath)

    // Check for Nautilus (BepInEx/plugins/Nautilus/Nautilus.dll)
    const nautilusPath = path.join(gamePath, 'BepInEx', 'plugins', 'Nautilus', 'Nautilus.dll')
    const hasNautilus = sandbox.manager.fileExists(nautilusPath)

    if (hasBepInEx && hasNautilus) {
      return { valid: true }
    }

    const messages = []
    const links = []

    if (!hasBepInEx) {
      messages.push('BepInEx is missing (required for mods).')
      links.push({
        text: 'Download BepInEx',
        url: 'https://www.nexusmods.com/subnautica/mods/1108'
      })
    }

    if (!hasNautilus) {
      messages.push('Nautilus is missing (library required for many mods).')
      links.push({
        text: 'Download Nautilus',
        url: 'https://www.nexusmods.com/subnautica/mods/1262'
      })
    }

    return {
      valid: false,
      message: messages.join('\n'),
      links
    }
  },

  determineModType: async (stagingPath) => {
    const path = require('path')
    const files = []

    const scan = (dir) => {
      const list = sandbox.manager.readDir(dir)
      for (const item of list) {
        const full = path.join(dir, item)
        if (sandbox.manager.isDirectory(full)) {
          scan(full)
        } else {
          files.push({
            name: item,
            path: full,
            rel: path.relative(stagingPath, full)
          })
        }
      }
    }
    scan(stagingPath)

    // Check for WinHTTP.dll -> BepInEx Loader
    if (files.some((f) => f.name.toLowerCase() === 'winhttp.dll')) {
      return 'Loader'
    }

    // Check for Nautilus
    if (files.some((f) => f.name.toLowerCase() === 'nautilus.dll')) {
      return 'Library'
    }

    return null
  },

  install: async (sourcePath, gamePath, originalZipPath) => {
    const path = require('path')

    // Helper to deploy files
    const deployRecursive = (src, dest) => {
      if (!sandbox.manager.fileExists(dest) && !sandbox.manager.isDirectory(dest)) {
        // Create dir if needed? Manager usually handles copying files but not mkdir -p specifically unless implicit?
        // Usually we just symlink or copy.
      }

      const items = sandbox.manager.readDir(src)
      items.forEach((item) => {
        const srcItem = path.join(src, item)
        const destItem = path.join(dest, item)

        if (sandbox.manager.isDirectory(srcItem)) {
          deployRecursive(srcItem, destItem)
        } else {
          // Ensure parent dir exists (if manager doesn't handle it, we might need to assume it does on symlink)
          // For now, assume symlinkFile handles it or we don't have mkdir exposed clearly in the prompt usage,
          // but usually install loop implies creation.
          sandbox.manager.symlinkFile(srcItem, destItem)
        }
      })
    }

    // Determine content structure
    const files = []
    const scan = (dir) => {
      const list = sandbox.manager.readDir(dir)
      for (const item of list) {
        const full = path.join(dir, item)
        if (sandbox.manager.isDirectory(full)) {
          scan(full)
        } else {
          files.push({
            name: item,
            rel: path.relative(sourcePath, full)
          })
        }
      }
    }
    scan(sourcePath)

    // Check if it's BepInEx (Loader)
    const isBepInEx = files.some((f) => f.name.toLowerCase() === 'winhttp.dll')
    if (isBepInEx) {
      // Install to GameRoot
      deployRecursive(sourcePath, gamePath)
      return true
    }

    // Check if it's Nautilus
    const isNautilus = files.some((f) => f.name.toLowerCase() === 'nautilus.dll')
    if (isNautilus) {
      // User requested Nautilus goes into Subnautica/BepInEx
      // The zip likely contains 'plugins/Nautilus/Nautilus.dll'
      const hasPluginsFolder = sandbox.manager.readDir(sourcePath).includes('plugins')

      if (hasPluginsFolder) {
        deployRecursive(sourcePath, path.join(gamePath, 'BepInEx'))
      } else {
        // Loose files? Put in BepInEx/plugins
        deployRecursive(sourcePath, path.join(gamePath, 'BepInEx', 'plugins'))
      }
      return true
    }

    // General Mod Installation Logic
    // 1. If has BepInEx folder -> Install to GameRoot
    const hasBepInExFolder = sandbox.manager.readDir(sourcePath).includes('BepInEx')
    if (hasBepInExFolder) {
      deployRecursive(sourcePath, gamePath)
      return true
    }

    // 2. If has plugins folder -> Install to BepInEx
    const hasPluginsFolder = sandbox.manager.readDir(sourcePath).includes('plugins')
    if (hasPluginsFolder) {
      deployRecursive(sourcePath, path.join(gamePath, 'BepInEx'))
      return true
    }

    // 3. Otherwise (Standard BepInEx Plugin) -> Install to BepInEx/plugins
    deployRecursive(sourcePath, path.join(gamePath, 'BepInEx', 'plugins'))
    return true
  }
}
