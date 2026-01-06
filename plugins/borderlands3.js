module.exports.default = {
  id: 'borderlands3',
  name: 'Borderlands 3',
  modSources: [
    { text: 'Nexus Mods', url: 'https://www.nexusmods.com/borderlands3' },
    { text: 'BLCM Wiki', url: 'https://github.com/BLCM/bl3mods/wiki' }
  ],
  steamAppId: '397540',
  executable: 'OakGame/Binaries/Win64/Borderlands3.exe',
  modFileExtensions: ['zip', 'rar', '7z', 'mod', 'bl3hotfix', 'pak', 'mp4'],

  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      // Common Steam path: steamapps/common/Borderlands 3
      const check = path.join(
        folder,
        'Borderlands 3',
        'OakGame',
        'Binaries',
        'Win64',
        'Borderlands3.exe'
      )
      if (sandbox.manager.fileExists(check)) {
        return path.join(folder, 'Borderlands 3')
      }
    }
    return null
  },

  determineModType: async (stagingPath) => {
    const path = require('path')

    // Recursive search with predicate
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

    // Check for Loaders (DLLs)
    if (
      find(stagingPath, (f) =>
        ['dinput8.dll', 'dsound.dll', 'openhotfixloader.dll'].includes(f.toLowerCase())
      )
    ) {
      return 'Loader'
    }

    // Check for SDK Mods (.sdkmod files or sdk_mods folder)
    if (
      find(stagingPath, (f, fullPath) => {
        return (
          f.toLowerCase().endsWith('.sdkmod') ||
          (f === '__init__.py' && fullPath.includes('sdk_mods'))
        )
      })
    ) {
      return 'SDK Mod'
    }

    // Check for PAK Mods (.pak files)
    if (find(stagingPath, (f) => f.toLowerCase().endsWith('.pak'))) {
      return 'PAK Mod'
    }

    // Check for Hotfixes
    if (find(stagingPath, (f) => f.toLowerCase().endsWith('.bl3hotfix'))) {
      return 'Hotfix'
    }
    if (find(stagingPath, (f) => f.toLowerCase().endsWith('.json'))) {
      // Simple JSONs might be hotfixes, but risky. Let's stick to explicit naming or bl3hotfix
      if (find(stagingPath, (f) => f.toLowerCase().includes('hotfix'))) return 'Hotfix'
    }

    return null
  },

  checkRequirements: async (gamePath) => {
    const path = require('path')
    const ohlPath = path.join(
      gamePath,
      'OakGame',
      'Binaries',
      'Win64',
      'Plugins',
      'OpenHotfixLoader.dll'
    )
    const sdkPathDinput = path.join(gamePath, 'OakGame', 'Binaries', 'Win64', 'dinput8.dll')
    const sdkPathDsound = path.join(gamePath, 'OakGame', 'Binaries', 'Win64', 'dsound.dll')

    const ohlExists = sandbox.manager.fileExists(ohlPath)
    const sdkExists =
      sandbox.manager.fileExists(sdkPathDinput) || sandbox.manager.fileExists(sdkPathDsound)

    if (ohlExists && sdkExists) {
      return { valid: true }
    }

    let message = 'Missing requirements:'
    const links = []

    if (!ohlExists) {
      message += ' OpenHotfixLoader'
      links.push({
        text: 'Download OpenHotfixLoader',
        url: 'https://github.com/apple1417/OpenHotfixLoader/releases'
      })
    }

    if (!sdkExists) {
      if (!ohlExists) message += ' & Python SDK'
      else message += ' Python SDK'

      links.push({
        text: 'Download Python SDK',
        url: 'https://github.com/bl-sdk/oak-mod-manager/releases'
      })
    }

    return {
      valid: false,
      message,
      links
    }
  },

  prepareForModding: async (gamePath) => {
    const path = require('path')
    sandbox.console.log('Preparing Borderlands 3 for modding...')

    const downloadAndInstall = async (url, filename) => {
      const zipPath = path.join(gamePath, filename)
      sandbox.console.log(`Downloading ${filename}...`)
      await sandbox.manager.downloadFile(url, zipPath)
      sandbox.console.log(`Installing ${filename}...`)
      await sandbox.manager.installMod(zipPath, { autoEnable: true })
      sandbox.manager.deleteFile(zipPath)
    }

    await downloadAndInstall(
      'https://github.com/apple1417/OpenHotfixLoader/releases/download/v1.6/OpenHotfixLoader.zip',
      'OpenHotfixLoader.zip'
    )

    await downloadAndInstall(
      'https://github.com/bl-sdk/oak-mod-manager/releases/download/v1.10/bl3-sdk.zip',
      'PythonSDK.zip'
    )

    return true
  },

  install: async (sourcePath, gamePath, originalZipPath) => {
    const path = require('path')

    const binariesDir = path.join(gamePath, 'OakGame/Binaries/Win64')
    const contentDir = path.join(gamePath, 'OakGame/Content')

    const installRules = [
      {
        id: 'loader',
        match: (f) => f.basename === 'openhotfixloader.dll',
        dest: (_) => path.join(binariesDir, 'Plugins', 'OpenHotfixLoader.dll')
      },
      {
        id: 'proxy',
        match: (f) => ['dinput8.dll', 'dsound.dll', 'xinput1_3.dll'].includes(f.basename),
        dest: (f) => path.join(binariesDir, f.basename)
      },
      {
        id: 'hotfix',
        match: (f) => f.ext === '.bl3hotfix',
        dest: (f) => path.join(binariesDir, 'Plugins', 'ohl-mods', f.basename)
      },
      {
        id: 'sdkmod',
        match: (f) => ['.py', '.sdkmod'].includes(f.ext),
        dest: (f) => path.join(binariesDir, 'sdk_mods', f.basename)
      },
      {
        id: 'pak',
        match: (f) => f.ext === '.pak',
        dest: (f) => path.join(contentDir, 'Paks', f.basename)
      },
      {
        id: 'movie',
        match: (f) => f.ext === '.mp4',
        dest: (f) => path.join(contentDir, 'Movies', f.basename)
      }
    ]

    const getAllFiles = (dir) => {
      let results = []
      const list = sandbox.manager.readDir(dir)
      list.forEach((file) => {
        const fullPath = path.join(dir, file)
        if (sandbox.manager.isDirectory(fullPath)) {
          results = results.concat(getAllFiles(fullPath))
        } else {
          results.push({
            absolute: fullPath,
            relative: path.relative(sourcePath, fullPath)
          })
        }
      })
      return results
    }

    const files = getAllFiles(sourcePath)

    for (const file of files) {
      const ext = path.extname(file.absolute).toLowerCase()
      const basename = path.basename(file.absolute).toLowerCase()
      let dest = ''

      const fileInfo = { ext, basename, absolute: file.absolute }
      const rule = installRules.find((r) => r.match(fileInfo))

      if (rule) {
        dest = rule.dest(fileInfo)
      } else {
        // Standard Mod Installation (mirror structure)
        dest = path.join(gamePath, file.relative)
      }

      // Ensure directory exists (implied by copyFile handling in some envs, but safer to try if we could)
      // sandbox.manager doesn't expose mkdir, but copyFile usually handles it or the manager implementation should.
      sandbox.manager.copyFile(file.absolute, dest)
    }
    return true
  }
}
