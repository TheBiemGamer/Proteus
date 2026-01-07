module.exports.default = {
  id: 'mhwilds',
  name: 'Monster Hunter Wilds',
  version: '1.0.3',
  author: 'TheBiemGamer',
  iconUrl: 'https://cdn2.steamgriddb.com/icon/7bbc9c659df818a7dfe58a4bc89f6442/32/256x256.png',
  modSources: [{ text: 'Nexus Mods', url: 'https://www.nexusmods.com/monsterhunterwilds' }],
  executable: 'MonsterHunterWilds.exe',
  steamAppId: '2246340',
  modFileExtensions: ['zip', 'rar', '7z', 'pak', 'lua', 'exe', 'dll'],
  theme: {
    accent: '202, 138, 4', // Dark Gold
    bgStart: '25, 20, 6'
  },

  getToolButtons: async (gamePath) => {
    if (!gamePath) return []
    const path = require('path')
    const fluffy1 = path.join(gamePath, 'Modmanager.exe')
    const fluffy2 = path.join(gamePath, 'FluffyModManager.exe')

    if (sandbox.manager.fileExists(fluffy1) || sandbox.manager.fileExists(fluffy2)) {
      return [{ label: 'Run Fluffy Mod Manager', action: 'runFluffy' }]
    }
    return []
  },

  runFluffy: async (gamePath) => {
    // Note: pluginLoader sets implicit context for active game, but args[0] might be missing if invoked without args
    // We should use sandbox.manager.getGamePath() if gamePath is missing.
    if (!gamePath || typeof gamePath !== 'string') gamePath = sandbox.manager.getGamePath()

    const path = require('path')
    const fluffy1 = path.join(gamePath, 'Modmanager.exe')
    const fluffy2 = path.join(gamePath, 'FluffyModManager.exe')

    if (sandbox.manager.fileExists(fluffy1)) {
      sandbox.manager.openPath(fluffy1)
    } else if (sandbox.manager.fileExists(fluffy2)) {
      sandbox.manager.openPath(fluffy2)
    } else {
      sandbox.manager.showAlert(
        'Fluffy Mod Manager Not Found',
        'Could not find ModManager.exe or FluffyModManager.exe in the game folder.'
      )
    }
  },

  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      // Standard Steam Path
      const check = path.join(folder, 'MonsterHunterWilds', 'MonsterHunterWilds.exe')
      if (sandbox.manager.fileExists(check)) {
        return path.dirname(check)
      }
      // Possible Benchmark Path pattern
      const checkBench = path.join(
        folder,
        'Monster Hunter Wilds Benchmark',
        'MonsterHunterWilds.exe'
      )
      if (sandbox.manager.fileExists(checkBench)) {
        return path.dirname(checkBench)
      }
    }
    return null
  },

  determineModType: async (stagingPath) => {
    const path = require('path')
    const find = (dir, predicate) => {
      const list = sandbox.manager.readDir(dir)
      for (const file of list) {
        const fullPath = path.join(dir, file)
        if (sandbox.manager.isDirectory(fullPath)) {
          if (find(fullPath, predicate)) return true
        } else {
          if (predicate(file, fullPath)) return true
        }
      }
      return false
    }

    if (find(stagingPath, (f) => f.toLowerCase() === 'dinput8.dll')) {
      return 'Loader'
    }

    // Classify Fluffy Mod Manager tool itself as a Loader
    if (
      find(
        stagingPath,
        (f) => f.toLowerCase() === 'modmanager.exe' || f.toLowerCase() === 'fluffymodmanager.exe'
      )
    ) {
      return 'Loader'
    }

    return null
  },

  prepareForModding: async (gamePath) => {
    const path = require('path')
    // 1. Check for REFramework (dinput8.dll)
    const refPath = path.join(gamePath, 'dinput8.dll')
    if (!sandbox.manager.fileExists(refPath)) {
      sandbox.console.log('REFramework not found. Attempting auto-install from GitHub...')
      try {
        // Fetch latest release info
        const releaseData = await sandbox.manager.fetch(
          'https://api.github.com/repos/praydog/REFramework-nightly/releases/latest'
        )
        // Fetch repo info for description
        const repoData = await sandbox.manager.fetch(
          'https://api.github.com/repos/praydog/REFramework-nightly'
        )

        if (releaseData && releaseData.assets) {
          const asset = releaseData.assets.find((a) => a.name === 'MHWILDS.zip')
          if (asset && asset.browser_download_url) {
            const tempZip = path.join(gamePath, 'MHWILDS.zip')
            sandbox.console.log(`Downloading ${asset.name}...`)
            await sandbox.manager.downloadFile(asset.browser_download_url, tempZip)

            let version = releaseData.tag_name
            // Remove 'v' prefix if present for clean versioning
            if (version.startsWith('v')) version = version.substring(1)

            sandbox.console.log('Installing REFramework...')
            await sandbox.manager.installMod(tempZip, {
              autoEnable: true,
              version: version,
              sourceUrl: 'https://github.com/praydog/REFramework-nightly',
              author: 'praydog',
              name: 'ReFramework',
              description: repoData.description || releaseData.body,
              imageUrl: releaseData.author ? releaseData.author.avatar_url : undefined
            })

            sandbox.manager.deleteFile(tempZip)
            sandbox.console.log('REFramework installed successfully.')
          } else {
            sandbox.console.log('Could not find MHWILDS.zip in the latest nightly release.')
          }
        }
      } catch (e) {
        sandbox.console.log(`Failed to download REFramework: ${e}`)
      }
    } else {
      sandbox.console.log('REFramework detected.')
    }
  },

  checkUpdate: async (mod) => {
    if (!mod.sourceUrl || !mod.sourceUrl.includes('github.com')) {
      return { supported: false }
    }

    try {
      // Extract user/repo from https://github.com/user/repo
      const match = mod.sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
      if (!match) return { supported: false, error: 'Invalid GitHub URL' }

      const repo = `${match[1]}/${match[2]}`
      const baseApi = `https://api.github.com/repos/${repo}/releases`

      // Special logic for REFramework-nightly
      // Usually "latest" works, but nightly builds might be weird.
      // Latest should work fine as long as they tag it correctly.
      const data = await sandbox.manager.fetch(`${baseApi}/latest`)

      let latest = data.tag_name
      // Strip 'v' prefix if present
      if (latest.startsWith('v')) latest = latest.substring(1)

      if (latest !== mod.version) {
        return {
          updateAvailable: true,
          latestVersion: latest,
          downloadUrl: data.assets[0]?.browser_download_url
        }
      }

      return { updateAvailable: false, latestVersion: latest }
    } catch (e) {
      return { error: e.message }
    }
  },

  determineModType: (modStagingPath) => {
    const findFluffy = (dir, depth) => {
      if (depth > 2) return false
      const contents = sandbox.manager.readDir(dir)
      const hasExe = contents.some(
        (f) => f.toLowerCase() === 'modmanager.exe' || f.toLowerCase() === 'fluffymodmanager.exe'
      )
      if (hasExe) return true

      // If single folder, dive in
      if (contents.length === 1) {
        const path = require('path')
        const sub = path.join(dir, contents[0])
        if (sandbox.manager.isDirectory(sub)) {
          return findFluffy(sub, depth + 1)
        }
      }
      return false
    }

    if (findFluffy(modStagingPath, 0)) {
      return {
        type: 'Loader',
        nexusId: '818',
        sourceUrl: 'https://www.nexusmods.com/site/mods/818',
        nexusDomain: 'site'
      }
    }
    return null
  },

  analyzeArchive: (files) => {
    // files is array of string paths inside the archive
    const isFluffy = files.some(
      (f) =>
        f.toLowerCase().endsWith('modmanager.exe') ||
        f.toLowerCase().endsWith('fluffymodmanager.exe')
    )
    if (isFluffy) {
      return {
        type: 'Loader',
        name: 'Fluffy Mod Manager',
        nexusId: '818',
        sourceUrl: 'https://www.nexusmods.com/site/mods/818',
        nexusDomain: 'site'
      }
    }
    return null
  },

  checkRequirements: async (gamePath) => {
    const path = require('path')

    // Check for REFramework
    const refPath = path.join(gamePath, 'dinput8.dll')
    const hasRef = sandbox.manager.fileExists(refPath)

    // Check for Fluffy Mod Manager (loose check for executable in game root)
    const fluffy1 = path.join(gamePath, 'ModManager.exe')
    const fluffy2 = path.join(gamePath, 'FluffyModManager.exe')
    const hasFluffy = sandbox.manager.fileExists(fluffy1) || sandbox.manager.fileExists(fluffy2)

    if (hasRef && hasFluffy) {
      return { valid: true }
    }

    const messages = []
    const links = []

    if (!hasRef) {
      messages.push('REFramework is missing (required for scripts).')
      links.push({
        text: 'Download REFramework',
        url: 'https://github.com/praydog/REFramework-nightly/releases'
      })
    }

    if (!hasFluffy) {
      messages.push('Fluffy Mod Manager not found in game folder (needed for most mods).')
      links.push({
        text: 'Download Fluffy Mod Manager',
        url: 'https://www.nexusmods.com/site/mods/818'
      })
    }

    return {
      valid: false,
      message: messages.join('\n'),
      links
    }
  },

  install: async (sourcePath, gamePath, originalZipPath) => {
    const path = require('path')
    sandbox.console.log(`Analyzing mod content from ${sourcePath}...`)

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
            rel: path.relative(sourcePath, full)
          })
        }
      }
    }
    scan(sourcePath)

    // Determine Installation Type
    const isReframeworkPackage = files.some((f) => f.name.toLowerCase() === 'dinput8.dll')
    const hasExe = files.some((f) => f.name.toLowerCase().endsWith('.exe'))
    const hasLooseLua =
      files.some((f) => f.name.toLowerCase().endsWith('.lua')) && files.length < 10

    let installRoot = ''
    let installType = ''
    let deploySource = sourcePath

    if (isReframeworkPackage) {
      installType = 'Root (REFramework)'
      installRoot = gamePath
    } else if (hasExe) {
      // Check if it is Fluffy
      const isFluffy = files.some(
        (f) =>
          f.name.toLowerCase() === 'modmanager.exe' ||
          f.name.toLowerCase() === 'fluffymodmanager.exe'
      )
      if (isFluffy) {
        installType = 'Fluffy Mod Manager'
        installRoot = gamePath
      } else {
        installType = 'Root (Executable)'
        installRoot = gamePath
      }
    } else if (hasLooseLua) {
      installType = 'REFramework Script'
      const normalize = (p) => p.replace(/\\/g, '/').toLowerCase()

      // Look for anchor folders regardless of depth
      // We want to find the shallowest occurrence
      let anchorReframework = null
      let anchorAutorun = null

      for (const f of files) {
        const rel = normalize(f.rel)

        // Check reframework
        if (rel.startsWith('reframework/')) {
          if (anchorReframework === null || anchorReframework.length > 0) anchorReframework = ''
        } else if (rel.includes('/reframework/')) {
          const parts = rel.split('/reframework/')
          const prefix = parts[0]
          if (anchorReframework === null || prefix.length < anchorReframework.length) {
            anchorReframework = prefix
          }
        }

        // Check autorun
        if (rel.startsWith('autorun/')) {
          if (anchorAutorun === null || anchorAutorun.length > 0) anchorAutorun = ''
        } else if (rel.includes('/autorun/')) {
          const parts = rel.split('/autorun/')
          const prefix = parts[0]
          if (anchorAutorun === null || prefix.length < anchorAutorun.length) {
            anchorAutorun = prefix
          }
        }
      }

      if (anchorReframework !== null) {
        // Install <Root>/<anchor> -> <Game>
        // Effectively maps <anchor>/reframework to <Game>/reframework
        installRoot = gamePath
        deploySource = path.join(sourcePath, anchorReframework)
      } else if (anchorAutorun !== null) {
        // Install <Root>/<anchor>/autorun -> <Game>/reframework/autorun
        installRoot = path.join(gamePath, 'reframework', 'autorun')
        deploySource = path.join(sourcePath, anchorAutorun, 'autorun')
      } else {
        // Default Loose
        installRoot = path.join(gamePath, 'reframework', 'autorun')
      }
    } else {
      installType = 'Fluffy Mod'
      // Fluffy structure: Games/MonsterHunterWilds/Mods/<ModName>
      // We derive ModName from the zip filename
      const modName = path.basename(originalZipPath, path.extname(originalZipPath))
      installRoot = path.join(gamePath, 'Games', 'MonsterHunterWilds', 'Mods', modName)
    }

    sandbox.console.log(`Mod Type identified as: ${installType}`)
    sandbox.console.log(`Installing to: ${installRoot}`)

    const deployRecursive = (src, dest) => {
      const items = sandbox.manager.readDir(src)
      items.forEach((item) => {
        const srcItem = path.join(src, item)
        const destItem = path.join(dest, item)

        // Filter for REFramework: Only install dinput8.dll
        if (installType === 'Root (REFramework)') {
          if (item.toLowerCase() !== 'dinput8.dll') {
            return
          }
        }

        if (sandbox.manager.isDirectory(srcItem)) {
          deployRecursive(srcItem, destItem)
        } else {
          sandbox.manager.symlinkFile(srcItem, destItem)
        }
      })
    }

    deployRecursive(deploySource, installRoot)

    // Notes for users
    if (installType === 'Fluffy Mod') {
      const note = 'NOTE: You must enable this mod in Fluffy Mod Manager to apply it to the game.'
      sandbox.console.log(note)
      return { success: true, note }
    } else if (installType === 'Fluffy Mod Manager') {
      return {
        success: true,
        nexusId: '818',
        sourceUrl: 'https://www.nexusmods.com/site/mods/818',
        nexusDomain: 'site'
      }
    }

    return true
  },

  onUnmanage: async (gamePath) => {
    const path = require('path')

    // Helper to attempt removal
    const tryRemove = (p) => {
      try {
        if (sandbox.manager.isDirectory(p)) {
          sandbox.manager.removeDir(p)
        }
      } catch (e) {
        // Ignore
      }
    }

    // 1. Clean Fluffy Mods structure
    const modsDir = path.join(gamePath, 'Games', 'MonsterHunterWilds', 'Mods')
    const installedIni = path.join(gamePath, 'Games', 'MonsterHunterWilds', 'installed.ini')

    // Remove installed.ini if present
    if (sandbox.manager.fileExists(installedIni)) {
      try {
        sandbox.manager.deleteFile(installedIni)
      } catch (e) {
        /* ignore */
      }
    }

    if (sandbox.manager.isDirectory(modsDir)) {
      const items = sandbox.manager.readDir(modsDir)
      for (const item of items) {
        tryRemove(path.join(modsDir, item))
      }
      tryRemove(modsDir)
    }

    // Clean parents up to Game
    tryRemove(path.join(gamePath, 'Games', 'MonsterHunterWilds'))
    tryRemove(path.join(gamePath, 'Games'))

    // 2. Clean REFramework
    const refDir = path.join(gamePath, 'reframework')
    if (sandbox.manager.isDirectory(refDir)) {
      tryRemove(path.join(refDir, 'autorun'))
      tryRemove(path.join(refDir, 'plugins'))
      tryRemove(path.join(refDir, 'data'))
      tryRemove(refDir)
    }
  }
}
