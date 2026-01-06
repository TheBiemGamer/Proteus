module.exports.default = {
  id: 'wonderlands',
  name: "Tiny Tina's Wonderlands",
  version: '1.0.1',
  author: 'TheBiemGamer',
  modSources: [
    { text: 'Nexus Mods', url: 'https://www.nexusmods.com/tinytinaswonderlands' },
    { text: 'BLCM Wiki', url: 'https://github.com/BLCM/wlmods/wiki' },
    { text: 'SDK Mod Database', url: 'https://bl-sdk.github.io/oak-mod-db/' }
  ],
  steamAppId: '1286680',
  executable: 'OakGame/Binaries/Win64/Wonderlands.exe',
  modFileExtensions: ['zip', 'rar', '7z', 'mod', 'wlhotfix', 'pak', 'mp4'],
  iconUrl: 'https://cdn2.steamgriddb.com/icon_thumb/c0b3cb0842f9f8148f618c587b48d5ba.png',
  theme: {
    accent: '168, 85, 247', // Purple
    bgStart: '20, 10, 30'
  },

  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      // Common Steam path: steamapps/common/Tiny Tina's Wonderlands
      const check = path.join(
        folder,
        "Tiny Tina's Wonderlands",
        'OakGame',
        'Binaries',
        'Win64',
        'Wonderlands.exe'
      )
      if (sandbox.manager.fileExists(check)) {
        return path.join(folder, "Tiny Tina's Wonderlands")
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
    if (find(stagingPath, (f) => f.toLowerCase().endsWith('.wlhotfix'))) {
      return 'Hotfix'
    }
    if (find(stagingPath, (f) => f.toLowerCase().endsWith('.json'))) {
      // Simple JSONs might be hotfixes, but risky.
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
      if (!ohlExists) message += ' & OakModManager'
      else message += ' OakModManager'

      links.push({
        text: 'Download OakModManager',
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
    sandbox.console.log("Preparing Tiny Tina's Wonderlands for modding...")

    const installFromGithub = async (repo, filePattern, renameTo = null) => {
      sandbox.console.log(`Checking latest release for ${repo}...`)
      try {
        const data = await sandbox.manager.fetch(
          `https://api.github.com/repos/${repo}/releases/latest`
        )
        const repoData = await sandbox.manager.fetch(`https://api.github.com/repos/${repo}`)

        const asset = data.assets.find((a) => a.name.match(filePattern))
        if (!asset) throw new Error(`No matching asset found for ${filePattern}`)

        let version = data.tag_name
        if (version.startsWith('v')) {
          version = version.substring(1)
        }

        const url = asset.browser_download_url
        const sourceUrl = `https://github.com/${repo}`

        // Use renamed filename if provided, otherwise original asset name
        const filename = renameTo || asset.name
        const author = repo.split('/')[0]

        const zipPath = path.join(gamePath, filename)
        sandbox.console.log(`Downloading ${filename} (v${version}) by ${author}...`)
        await sandbox.manager.downloadFile(url, zipPath)

        sandbox.console.log(`Installing ${filename}...`)
        await sandbox.manager.installMod(zipPath, {
          autoEnable: true,
          version: version,
          sourceUrl: sourceUrl,
          author: author,
          description: repoData.description || data.body,
          imageUrl: data.author ? data.author.avatar_url : undefined
        })
        sandbox.manager.deleteFile(zipPath)
        return true
      } catch (e) {
        sandbox.console.log(`Failed to install ${repo}: ${e.message}`)
        return false
      }
    }

    await installFromGithub('apple1417/OpenHotfixLoader', /OpenHotfixLoader\.zip/i)
    // Modified sdk zip requirement and path
    await installFromGithub('bl-sdk/oak-mod-manager', /wl-sdk\.zip/i, 'OakModManager.zip')

    return true
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
      const data = await sandbox.manager.fetch(
        `https://api.github.com/repos/${repo}/releases/latest`
      )

      let latest = data.tag_name
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
        match: (f) => f.ext === '.wlhotfix',
        dest: (f) => path.join(binariesDir, 'Plugins', 'ohl-mods', f.basename)
      },
      {
        id: 'sdkmod',
        match: (f) => ['.py', '.sdkmod'].includes(f.ext),
        dest: (f) => {
          const parts = f.relative.split(path.sep)
          const sdkIdx = parts.indexOf('sdk_mods')
          if (sdkIdx !== -1) {
            return path.join(gamePath, 'sdk_mods', ...parts.slice(sdkIdx + 1))
          }
          return path.join(gamePath, 'sdk_mods', f.relative)
        }
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

      const fileInfo = { ext, basename, absolute: file.absolute, relative: file.relative }
      const rule = installRules.find((r) => r.match(fileInfo))

      if (rule) {
        dest = rule.dest(fileInfo)
      } else {
        // Standard Mod Installation (mirror structure)
        dest = path.join(gamePath, file.relative)
      }

      // Ensure directory exists (implied by copyFile handling in some envs)
      sandbox.manager.copyFile(file.absolute, dest)
    }
    return true
  }
}
