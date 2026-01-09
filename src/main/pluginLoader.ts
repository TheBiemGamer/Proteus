import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { NodeVM } from 'vm2'
import AdmZip from 'adm-zip'
import axios from 'axios'
import { EventEmitter } from 'events'
import { IGameExtension, IMod } from '../shared/types'
import { listArchiveFiles, extractArchive } from './utils/archives'
import { fetchNexusMetadata, checkNexusUpdate, validateModByHash } from './utils/nexus'
import { ModpackManager } from './features/modpack'

interface EpicGameInfo {
  path: string
  epicAppId: string
}

interface GameManifest {
  mods: IMod[]
  managed: boolean
  deploymentMethod?: 'symlink' | 'hardlink' | 'copy'
}

export class PluginManager extends EventEmitter {
  private plugins: Map<string, IGameExtension> = new Map()
  private pluginFiles: Map<string, string> = new Map()
  private pluginsDir: string
  private stagingDir: string
  // gamePaths stores WHERE they are. State is stored IN the game dir.
  private gamePaths: Record<string, string> = {}
  private settingsPath: string

  // Context
  private activeGamePath: string | null = null
  private currentPluginPath: string | null = null
  private activeModId: string | null = null
  private activeGameId: string | null = null
  private sandboxErrors: Error[] = [] // Track errors during sandbox execution

  private nexusApiKey = ''
  private epicGamesManifestDir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests'
  private epicGames: Record<string, EpicGameInfo> = {}
  private deploymentMethod: 'symlink' | 'hardlink' | 'copy' = 'symlink'
  private repairedGames = new Set<string>()

  setNexusApiKey(key?: string) {
    this.nexusApiKey = key || ''
  }

  setDeploymentMethod(method?: 'symlink' | 'hardlink' | 'copy') {
    this.deploymentMethod = method || 'symlink'
  }

  private modpackManager: ModpackManager

  constructor(appPath: string) {
    super()
    this.pluginsDir = path.join(appPath, 'plugins')
    this.stagingDir = path.join(app.getPath('userData'), 'Staging')

    if (!fs.existsSync(this.pluginsDir)) fs.mkdirSync(this.pluginsDir)
    if (!fs.existsSync(this.stagingDir)) fs.mkdirSync(this.stagingDir)

    const userData = app.getPath('userData')
    this.settingsPath = path.join(userData, 'game-paths.json')

    this.loadSettings()
    this.detectEpicGames().then((games) => (this.epicGames = games))

    // Initialize Helpers
    this.modpackManager = new ModpackManager({
      readManifest: this.readManifest.bind(this),
      writeManifest: this.writeManifest.bind(this),
      stagingDir: this.stagingDir,
      gamePaths: this.gamePaths,
      runCommand: this.runCommand.bind(this),
      enableMod: this.enableMod.bind(this),
      installMod: this.installMod.bind(this),
      _fetchNexusMetadata: this._fetchNexusMetadata.bind(this)
    })
  }

  private loadSettings() {
    if (fs.existsSync(this.settingsPath)) {
      try {
        this.gamePaths = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'))
      } catch {}
    }
  }

  private saveSettings() {
    fs.writeFileSync(this.settingsPath, JSON.stringify(this.gamePaths, null, 2))
  }

  // --- Per-Game Manifest Management ---

  private getManifestPath(gameId: string): string | null {
    const gamePath = this.gamePaths[gameId]
    if (!gamePath) return null
    // Priority: .pmm (Proprietary format)
    const pmmPath = path.join(gamePath, 'modmanager.pmm')
    if (fs.existsSync(pmmPath)) return pmmPath

    // Fallback: Legacy JSON
    const jsonPath = path.join(gamePath, 'modmanager.json')
    if (fs.existsSync(jsonPath)) return jsonPath

    // Default new
    return pmmPath
  }

  private readManifest(gameId: string): GameManifest {
    const manifestPath = this.getManifestPath(gameId)
    let data: GameManifest = { mods: [], managed: false }
    let loadSuccess = false

    if (!manifestPath) return data

    try {
      if (fs.existsSync(manifestPath)) {
        data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        loadSuccess = true
      }
    } catch (e) {
      console.error(`Failed to read manifest for ${gameId}:`, e)
      return { mods: [], managed: false }
    }

    // Integrity Check: Verify Staging Availability
    if (data.managed) {
      const gameStagingDir = path.join(this.stagingDir, gameId)
      const stagingRootExists = fs.existsSync(gameStagingDir)
      let changed = false

      data.mods.forEach((mod) => {
        if (mod.enabled) {
          const modStagingPath = path.join(gameStagingDir, mod.id)
          if (!stagingRootExists || !fs.existsSync(modStagingPath)) {
            // Mod source is missing.
            mod.enabled = false
            mod.error = 'Source missing'
            changed = true
          }
        }
      })

      // Migration Check
      const isLegacy = manifestPath.endsWith('.json')

      if (loadSuccess && (changed || isLegacy)) {
        this.writeManifest(gameId, data)
        if (isLegacy) {
          try {
            fs.unlinkSync(manifestPath)
          } catch {}
        }
      }
    }

    return data
  }

  private writeManifest(gameId: string, data: GameManifest) {
    const gamePath = this.gamePaths[gameId]
    if (!gamePath) return
    
    if (!data.deploymentMethod) {
      data.deploymentMethod = this.deploymentMethod
    }

    // Sort mods: Loaders first, then Alphabetical
    data.mods.sort((a, b) => {
      const aIsLoader = (a.type || '').toLowerCase() === 'loader'
      const bIsLoader = (b.type || '').toLowerCase() === 'loader'
      if (aIsLoader && !bIsLoader) return -1
      if (!aIsLoader && bIsLoader) return 1
      return a.name.localeCompare(b.name)
    })

    // Always save as .pmm
    const pmmPath = path.join(gamePath, 'modmanager.pmm')
    fs.writeFileSync(pmmPath, JSON.stringify(data, null, 2))
  }

  // --- Security ---

  private isSafePath(targetPath: string): boolean {
    if (this.activeGamePath === 'SAFE_MODE_DETECT') return true
    if (!this.activeGamePath) return false
    const resolvedTarget = path.resolve(targetPath)
    const resolvedSafe = path.resolve(this.activeGamePath)

    if (process.platform === 'win32') {
      return resolvedTarget.toLowerCase().startsWith(resolvedSafe.toLowerCase())
    }

    return resolvedTarget.startsWith(resolvedSafe)
  }

  private registerInstalledFile(filePath: string) {
    if (!this.activeGameId || !this.activeModId) return
    const manifest = this.readManifest(this.activeGameId)
    const mod = manifest.mods.find((m) => m.id === this.activeModId)
    if (mod) {
      mod.files.push(filePath)
      this.writeManifest(this.activeGameId, manifest)
    }
  }

  // --- VM / Sandbox ---

  private createSandbox() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return {
      console: { log: (msg: string) => console.log(`[PLUGIN]: ${msg}`) },
      get pluginPath() {
        return self.currentPluginPath
      },
      manager: {
        fileExists: (filePath: string) => fs.existsSync(filePath),
        isDirectory: (filePath: string) => {
          try {
            return fs.lstatSync(filePath).isDirectory()
          } catch {
            return false
          }
        },
        readDir: (dirPath: string) => {
          try {
            return fs.readdirSync(dirPath)
          } catch {
            return []
          }
        },
        getZipEntries: (zipPath: string) => {
          try {
            return new AdmZip(zipPath).getEntries().map((e) => e.entryName)
          } catch {
            return []
          }
        },
        unzipFile: (zipPath: string, dest: string) => {
          new AdmZip(zipPath).extractAllTo(dest, true)
        },
        copyFile: (src: string, dest: string) => {
          if (!this.isSafePath(dest)) throw new Error(`Access Denied: ${dest}`)
          const destDir = path.dirname(dest)
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
          fs.copyFileSync(src, dest)
          this.registerInstalledFile(dest)
        },
        symlinkFile: (src: string, dest: string) => {
          if (!this.isSafePath(dest)) throw new Error(`Access Denied: ${dest}`)
          const destDir = path.dirname(dest)
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
          if (fs.existsSync(dest)) fs.unlinkSync(dest)

          // Respect Deployment Method
          if (this.deploymentMethod === 'copy') {
            try {
              fs.copyFileSync(src, dest)
              console.log(`[FileInstall] Copied (User Setting): ${path.basename(src)}`)
              this.registerInstalledFile(dest)
              return
            } catch (e) {
              console.error(`Copy failed: ${e}`)
              throw e
            }
          } else if (this.deploymentMethod === 'hardlink') {
            try {
              fs.linkSync(src, dest)
              console.log(`[FileInstall] Hardlinked (User Setting): ${path.basename(src)}`)
              this.registerInstalledFile(dest)
              return
            } catch (e) {
              console.warn(`[FileInstall] Hardlink failed (${e}), falling back to copy.`)
              fs.copyFileSync(src, dest)
              console.log(`[FileInstall] Copied (Fallback): ${path.basename(src)}`)
              this.registerInstalledFile(dest)
              return
            }
          }

          try {
            const stat = fs.lstatSync(src)
            if (stat.isDirectory()) {
              fs.symlinkSync(src, dest, 'junction')
            } else {
              try {
                fs.symlinkSync(src, dest, 'file')
                console.log(`[FileInstall] Symlinked: ${path.basename(src)}`)
              } catch (err: any) {
                // Windows requires Admin or Developer Mode for file symlinks.
                // Fallback to Hardlinks if possible.
                const isWinPermError =
                  process.platform === 'win32' && (err.code === 'EPERM' || err.code === 'EACCES')

                if (isWinPermError) {
                  console.log(
                    `[FileInstall] Symlink prevented by OS (Dev Mode disabled?). Attempting Hardlink...`
                  )
                } else {
                  console.warn(`[FileInstall] Symlink failed (${err.code}). Attempting Hardlink...`)
                }

                try {
                  const srcRoot = path.parse(src).root
                  const destRoot = path.parse(dest).root
                  if (srcRoot.toLowerCase() === destRoot.toLowerCase()) {
                    fs.linkSync(src, dest)
                    console.log(`[FileInstall] Hardlinked: ${path.basename(src)}`)
                  } else {
                    throw new Error('Cross-device link')
                  }
                } catch (hardlinkErr: any) {
                  console.warn(`[FileInstall] Hardlink failed (${hardlinkErr.message}). Copying...`)
                  fs.copyFileSync(src, dest)
                  console.log(`[FileInstall] Copied (Fallback): ${path.basename(src)}`)
                }
              }
            }
            this.registerInstalledFile(dest)
          } catch (e) {
            console.error(`Link failed: ${e}`)
            throw e
          }
        },
        deleteFile: (filePath: string) => {
          if (!this.isSafePath(filePath)) throw new Error(`Access Denied: ${filePath}`)
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        },
        removeDir: (dirPath: string) => {
          if (!this.isSafePath(dirPath)) throw new Error(`Access Denied: ${dirPath}`)
          if (fs.existsSync(dirPath)) {
            try {
              fs.rmdirSync(dirPath)
            } catch (e) {
              // Ignore error if not empty
            }
          }
        },
        fetch: async (url: string) => {
          try {
            const response = await axios.get(url)
            return response.data
          } catch (e: any) {
            // Handle GitHub API rate limit errors
            if (e.response?.status === 403 && e.response?.data?.message) {
              const message = e.response.data.message
              if (message.includes('rate limit exceeded') || message.includes('API rate limit')) {
                const resetTime = e.response.headers['x-ratelimit-reset']
                let errorMessage = 'GitHub API rate limit exceeded. '

                if (resetTime) {
                  const resetDate = new Date(parseInt(resetTime) * 1000)
                  const now = new Date()
                  const minutesUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / 60000)
                  errorMessage += `Please try again in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}. `
                }

                errorMessage +=
                  'You can continue using the mod manager, but automatic mod loader installation will be skipped for now.'

                const rateLimitError = new Error(errorMessage)
                ;(rateLimitError as any).isRateLimit = true
                ;(rateLimitError as any).isRecoverable = true

                // Track this error even if plugin catches it
                self.sandboxErrors.push(rateLimitError)

                throw rateLimitError
              }
            }

            // Handle other GitHub API errors
            if (e.response?.status && e.response?.status >= 400) {
              const errorMessage = `Failed to fetch from GitHub API: ${e.response.status} ${e.response.statusText}`
              const apiError = new Error(errorMessage)
              ;(apiError as any).isRecoverable = true

              // Track this error even if plugin catches it
              self.sandboxErrors.push(apiError)

              throw apiError
            }

            console.error('Fetch failed', e)
            throw e
          }
        },
        downloadFile: async (url: string, dest: string) => {
          if (!this.isSafePath(dest)) throw new Error(`Access Denied: ${dest}`)
          try {
            const response = await axios({ url, method: 'GET', responseType: 'stream' })
            const totalLength = response.headers['content-length']
            let downloaded = 0

            const writer = fs.createWriteStream(dest)

            response.data.on('data', (chunk) => {
              downloaded += chunk.length
              if (totalLength) {
                const progress = Math.round((downloaded / parseInt(totalLength)) * 100)
                this.emit('download-progress', { url, progress })
              }
            })

            response.data.pipe(writer)
            return new Promise<void>((resolve, reject) => {
              writer.on('finish', () => resolve())
              writer.on('error', reject)
            })
          } catch (e) {
            console.error('Download failed', e)
            throw e
          }
        },
        getGamePath: () => {
          if (this.activeGamePath === 'SAFE_MODE_DETECT') return null
          return this.activeGamePath
        },
        registerMod: (mod: IMod) => {
          if (!this.activeGameId) return
          const manifest = this.readManifest(this.activeGameId)
          const existing = manifest.mods.find((m) => m.id === mod.id)
          if (!existing) {
            manifest.mods.push(mod)
            this.writeManifest(this.activeGameId, manifest)
          }
        },
        installMod: async (
          zipPath: string,
          options?: {
            autoEnable?: boolean
            version?: string
            sourceUrl?: string
            author?: string
            name?: string
            type?: string
          }
        ) => {
          if (!this.activeGameId) throw new Error('No active game')
          return self.installMod(this.activeGameId, zipPath, options)
        },
        openUrl: async (url: string) => {
          await require('electron').shell.openExternal(url)
        },
        openPath: async (p: string) => {
          if (!this.isSafePath(p)) throw new Error(`Access Denied: ${p}`)
          await require('electron').shell.openPath(p)
        },
        showAlert: async (title: string, message: string) => {
          await require('electron').dialog.showMessageBox({
            type: 'info',
            title,
            message,
            buttons: ['OK']
          })
        }
      }
    }
  }

  // --- API ---

  private async detectEpicGames(): Promise<Record<string, EpicGameInfo>> {
    const epicGames: Record<string, EpicGameInfo> = {}
    if (fs.existsSync(this.epicGamesManifestDir)) {
      const files = fs.readdirSync(this.epicGamesManifestDir)
      for (const file of files) {
        if (path.extname(file) === '.item') {
          try {
            const manifest = JSON.parse(
              fs.readFileSync(path.join(this.epicGamesManifestDir, file), 'utf8')
            )
            if (
              manifest.AppName &&
              manifest.InstallLocation &&
              manifest.CatalogNamespace &&
              manifest.CatalogItemId
            ) {
              const epicAppId = `${manifest.CatalogNamespace}%3A${manifest.CatalogItemId}%3A${manifest.AppName}`
              epicGames[manifest.AppName] = {
                path: manifest.InstallLocation,
                epicAppId
              }
            }
          } catch {}
        }
      }
    }
    return epicGames
  }

  async autoDetectGames() {
    const candidates = [
      ...Object.values(this.epicGames).map((g) => g.path),
      'C:\\Program Files (x86)\\Steam\\steamapps\\common',
      'C:\\Program Files\\Steam\\steamapps\\common',
      'D:\\SteamLibrary\\steamapps\\common',
      'E:\\SteamLibrary\\steamapps\\common'
    ]
    for (const plugin of this.plugins.values()) {
      if (!this.gamePaths[plugin.id]) {
        const foundPath = await this.runCommand(plugin.id, 'detect', candidates)
        if (foundPath && typeof foundPath === 'string') {
          this.gamePaths[plugin.id] = foundPath
        }
      }
    }
    this.saveSettings()
    return this.getGamesWithDetails()
  }

  private getGamesInternal() {
    const result: any[] = []
    for (const [key, plugin] of Array.from(this.plugins.entries())) {
      const id = String(key)
      if (this.gamePaths[id]) {
        const manifest = this.readManifest(id)

        const name = String(plugin.name)
        const steamAppId = plugin.steamAppId ? String(plugin.steamAppId) : undefined
        const epicGameInfo = this.epicGames[plugin.name]
        const platform = epicGameInfo ? 'epic' : 'steam'
        const epicAppId = epicGameInfo ? epicGameInfo.epicAppId : undefined
        const iconUrl = (plugin as any).iconUrl ? String((plugin as any).iconUrl) : undefined

        let modSources: { text: string; url: string }[] | undefined
        try {
          const rawSources = (plugin as any).modSources
          if (Array.isArray(rawSources)) {
            modSources = rawSources.map((s: any) => ({
              text: String(s.text),
              url: String(s.url)
            }))
          }
        } catch (e) {
          modSources = undefined
        }

        let theme: { accent: string; bgStart: string; bgEnd?: string } | undefined
        try {
          const rawTheme = (plugin as any).theme
          if (rawTheme) {
            theme = {
              accent: String(rawTheme.accent),
              bgStart: String(rawTheme.bgStart),
              bgEnd: rawTheme.bgEnd ? String(rawTheme.bgEnd) : undefined
            }
          }
        } catch {}

        result.push({
          id,
          name,
          detected: true,
          managed: manifest.managed,
          path: this.gamePaths[id],
          steamAppId,
          epicAppId,
          platform,
          iconUrl,
          modSources,
          theme,
          toolButtons: []
        })
      }
    }
    return JSON.parse(JSON.stringify(result))
  }

  public async getGamesWithDetails() {
    const games = this.getGamesInternal()
    for (const game of games) {
      if (game.managed) {
        try {
          const plugin = this.plugins.get(game.id)
          if (plugin && (plugin as any).getToolButtons) {
            const buttons = await this.runCommand(game.id, 'getToolButtons', game.path)
            if (Array.isArray(buttons)) {
              game.toolButtons = buttons
            }
          } else if (plugin && (plugin as any).toolButtons) {
            game.toolButtons = (plugin as any).toolButtons
          }
        } catch (e) {}
      }
    }
    return JSON.parse(JSON.stringify(games))
  }

  // Called by UI when user clicks "Manage"
  async manageGame(gameId: string) {
    if (!this.gamePaths[gameId]) throw new Error('Game path not known')

    let manifest = this.readManifest(gameId)
    manifest.managed = true
    this.writeManifest(gameId, manifest)

    try {
      await this.runCommand(gameId, 'prepareForModding', this.gamePaths[gameId])

      // If we get here, prepareForModding succeeded, but check for tracked errors anyway
      if (this.sandboxErrors.length > 0) {
        // Find rate limit errors first (most common)
        const rateLimitError = this.sandboxErrors.find((e: any) => e.isRateLimit)
        if (rateLimitError) {
          const error = new Error(rateLimitError.message)
          ;(error as any).isRateLimit = true
          ;(error as any).isRecoverable = true
          ;(error as any).gameManaged = true
          throw error
        }

        // Otherwise, use the first recoverable error
        const recoverableError = this.sandboxErrors.find((e: any) => e.isRecoverable)
        if (recoverableError) {
          const error = new Error(recoverableError.message)
          ;(error as any).isRecoverable = true
          ;(error as any).gameManaged = true
          throw error
        }
      }
    } catch (e: any) {
      console.warn(`[PM] prepareForModding failed for ${gameId}`, e)

      // Check if this is a rate limit or recoverable error that we can handle
      if (e?.isRateLimit || e?.isRecoverable) {
        // Game is managed, throw error for UI feedback
        const error = new Error(e.message)
        ;(error as any).isRecoverable = true
        ;(error as any).gameManaged = true
        throw error
      }

      // For non-recoverable errors, still throw but mark game as managed
      const error = new Error(
        `Game setup encountered an error: ${e.message || String(e)}. The game has been marked as managed, but some setup steps may have failed.`
      )
      ;(error as any).gameManaged = true
      throw error
    } finally {
      // Clear tracked errors after checking
      this.sandboxErrors = []
    }

    // 2. Auto-install Loader if present
    const pluginFile = this.pluginFiles.get(gameId)
    if (pluginFile) {
      const pluginDir = path.dirname(pluginFile)
      const files = fs.readdirSync(pluginDir)
      for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        if (['.zip', '.rar', '.7z', '.mod'].includes(ext)) {
          if (file.toLowerCase().includes('loader')) {
            console.log(`Found bundled loader: ${file}`)
            await this.installMod(gameId, path.join(pluginDir, file), true)
          }
        }
      }
    }

    manifest = this.readManifest(gameId)
    return this.getGamesWithDetails()
  }

  async addGame(gameId: string, gameName: string, executablePath: string) {
    const pluginPath = path.join(this.pluginsDir, `${gameId}.js`)
    if (fs.existsSync(pluginPath)) {
      return { success: false, error: 'A plugin for this game already exists.' }
    }

    const pluginContent = `
module.exports.default = {
  id: '${gameId}',
  name: '${gameName}',
  executable: '${path.basename(executablePath)}',
  version: '1.0.0',
  author: 'User',
  detect: async (candidates) => {
    const path = require('path')
    for (const folder of candidates) {
      const check = path.join(folder, '${path.basename(executablePath)}')
      if (sandbox.manager.fileExists(check)) {
        return folder
      }
    }
    return null
  }
}
`

    try {
      fs.writeFileSync(pluginPath, pluginContent)
      this.gamePaths[gameId] = path.dirname(executablePath)
      this.saveSettings()
      this.loadPlugins()
      return { success: true }
    } catch (e: any) { 
      return { success: false, error: e.message }
    }
  }

  async unmanageGame(gameId: string) {
    if (!this.gamePaths[gameId]) throw new Error('Game path not known')

    await this.disableAllMods(gameId)

    const gameStagingDir = path.join(this.stagingDir, gameId)
    if (fs.existsSync(gameStagingDir)) {
      try {
        fs.rmSync(gameStagingDir, { recursive: true, force: true })
      } catch (e) {
        console.error('Failed to remove staging dir', e)
      }
    }

    const manifestPath = this.getManifestPath(gameId)
    if (manifestPath && fs.existsSync(manifestPath)) {
      try {
        fs.unlinkSync(manifestPath)
      } catch (e) {
        console.error('Failed to remove manifest', e)
      }
    }

    try {
      await this.runCommand(gameId, 'onUnmanage', this.gamePaths[gameId])
    } catch (e) {
      console.warn('Plugin onUnmanage hook failed:', e)
    }

    return this.getGamesWithDetails()
  }

  private async resolveModMetadata(
    gameId: string,
    filePath: string,
    providedOptions?: {
      name?: string
      nexusId?: string
      version?: string
      author?: string
      description?: string
      imageUrl?: string
      sourceUrl?: string
      type?: string
    }
  ): Promise<{
    displayName: string
    version?: string
    nexusId?: string
    author: string
    description?: string
    imageUrl?: string
    sourceUrl?: string
    type: string
    nexusDomain?: string
    note?: string
  }> {
    const filenameNoExt = path.parse(filePath).name
    let displayName = filenameNoExt
    if (providedOptions?.name) displayName = providedOptions.name

    let nexusId: string | undefined = providedOptions?.nexusId
    let version: string | undefined = providedOptions?.version
    let author: string = providedOptions?.author || 'Unknown'
    let description: string | undefined = providedOptions?.description
    let imageUrl: string | undefined = providedOptions?.imageUrl
    let sourceUrl: string | undefined = providedOptions?.sourceUrl
    let nexusDomain: string | undefined
    let type = providedOptions?.type || 'mod'
    let note: string | undefined

    // 1. Hash Check (Primary Identification Method)
    let hashMatchFound = false
    let hashCheckStatus: 'match' | 'not-found' | 'error' | 'skipped' = 'skipped'

    const isGithub = sourceUrl && sourceUrl.includes('github.com')

    if (this.nexusApiKey && !isGithub) {
      try {
        const checkSlug = this.getNexusSlug(gameId)
        console.log(`[HashCheck] Checking ${path.basename(filePath)} against ${checkSlug}`)
        const md5Result = await validateModByHash(this.nexusApiKey, checkSlug, filePath)

        let foundId: string | number | undefined

        // Handling multiple results (e.g. reused core files in different mods)
        if (Array.isArray(md5Result)) {
          // If multiple matches, use regex on filename to disambiguate
          const filename = path.basename(filePath)
          const greedyRegex = /^(.*)-(\d+)-(.+)$/
          const match = filename.match(greedyRegex)

          if (match) {
            const potentialId = match[2]
            const found = md5Result.find((r) => {
              const id = (r.mod && r.mod.mod_id) || r.mod_id
              return id && id.toString() === potentialId
            })
            if (found) {
              foundId = (found.mod && found.mod.mod_id) || found.mod_id
            }
          }

          // Improved Fallback Strategy:
          // If the regex match failed (or logic above didn't find the specific mod),
          // we should look for the "main" mod if possible, or try to avoid "Modpacks/Guides".
          // In the user's example, ID 335 is a "Guide/Bundle", while ID 72 is the original mod.
          // Heuristic: Prefer results where the file_name closely matches the zip name?
          // Or check category? (Guide categories usually differ).

          if (!foundId && md5Result.length > 0) {
            // Priority 1: Exact File Name Match (if info available)
            // The Nexus MD5 API returns `file_details.file_name`.
            const exactFileMatch = md5Result.find(
              (r) => r.file_details && r.file_details.file_name === filename
            )

            if (exactFileMatch) {
              foundId = (exactFileMatch.mod && exactFileMatch.mod.mod_id) || exactFileMatch.mod_id
              // Extract version from file_details
              if (exactFileMatch.file_details) {
                const fileDetails = exactFileMatch.file_details
                if (fileDetails.version && !version) {
                  version = fileDetails.version
                  console.log(`[HashCheck] Using file version from exact match: ${version}`)
                } else if (fileDetails.mod_version && !version) {
                  version = fileDetails.mod_version
                  console.log(`[HashCheck] Using mod version from exact match: ${version}`)
                }
              }
            } else {
              // Priority 2: Avoid "Guide" or "Modpack" in the name if alternatives exist
              // (This is a heuristic, but often valid for duplicated files)
              const betterMatch = md5Result.find((r) => {
                const name = (r.mod && r.mod.name) || ''
                return !name.toLowerCase().includes('guide') && !name.toLowerCase().includes('pack')
              })

              if (betterMatch) {
                foundId = (betterMatch.mod && betterMatch.mod.mod_id) || betterMatch.mod_id
                // Extract version from file_details
                if (betterMatch.file_details) {
                  const fileDetails = betterMatch.file_details
                  if (fileDetails.version && !version) {
                    version = fileDetails.version
                    console.log(`[HashCheck] Using file version from better match: ${version}`)
                  } else if (fileDetails.mod_version && !version) {
                    version = fileDetails.mod_version
                    console.log(`[HashCheck] Using mod version from better match: ${version}`)
                  }
                }
              } else {
                // Default to first
                const first = md5Result[0]
                foundId = (first.mod && first.mod.mod_id) || first.mod_id
                // Extract version from file_details
                if (first.file_details) {
                  const fileDetails = first.file_details
                  if (fileDetails.version && !version) {
                    version = fileDetails.version
                    console.log(`[HashCheck] Using file version from first match: ${version}`)
                  } else if (fileDetails.mod_version && !version) {
                    version = fileDetails.mod_version
                    console.log(`[HashCheck] Using mod version from first match: ${version}`)
                  }
                }
              }
            }
          }
        } else if (md5Result) {
          // Single result
          if (md5Result.mod && md5Result.mod.mod_id) foundId = md5Result.mod.mod_id
          else if (md5Result.mod_id) foundId = md5Result.mod_id

          // Extract version from file_details
          if (md5Result.file_details) {
            const fileDetails = md5Result.file_details
            if (fileDetails.version && !version) {
              version = fileDetails.version
              console.log(`[HashCheck] Using file version from single result: ${version}`)
            } else if (fileDetails.mod_version && !version) {
              version = fileDetails.mod_version
              console.log(`[HashCheck] Using mod version from single result: ${version}`)
            }
          }
        }

        if (foundId) {
          nexusId = foundId.toString()
          hashMatchFound = true
          hashCheckStatus = 'match'
          console.log(`[HashCheck] Match found! ID: ${nexusId}`)

          // Extract version from file_details if available
          let matchedResult: any = null
          if (Array.isArray(md5Result)) {
            matchedResult = md5Result.find((r) => {
              const id = (r.mod && r.mod.mod_id) || r.mod_id
              return id && id.toString() === foundId.toString()
            })
          } else if (md5Result) {
            matchedResult = md5Result
          }

          if (matchedResult && matchedResult.file_details) {
            const fileDetails = matchedResult.file_details
            if (fileDetails.version && !version) {
              version = fileDetails.version
              console.log(`[HashCheck] Using file version: ${version}`)
            }
            if (fileDetails.mod_version && !version) {
              version = fileDetails.mod_version
              console.log(`[HashCheck] Using mod version: ${version}`)
            }
          }
        } else {
          hashCheckStatus = 'not-found'
          console.log(`[HashCheck] No match found or Invalid Structure.`)

          // CROSS-GAME CHECK
          // If the hash wasn't found for the current game, check other managed games.
          for (const [otherId] of this.plugins.entries()) {
            if (otherId === gameId || !this.gamePaths[otherId]) continue // Skip current or unmanaged

            try {
              const otherSlug = this.getNexusSlug(otherId)
              if (otherSlug === checkSlug) continue

              const otherMatch = await validateModByHash(this.nexusApiKey, otherSlug, filePath)
              // If match is found in another game
              if (otherMatch && (Array.isArray(otherMatch) ? otherMatch.length > 0 : true)) {
                // Pick best match to show in preview
                let match = Array.isArray(otherMatch) ? otherMatch[0] : otherMatch

                if (Array.isArray(otherMatch)) {
                  // If multiple matches, use regex on filename to disambiguate
                  const filename = path.basename(filePath)
                  const greedyRegex = /^(.*)-(\d+)-(.+)$/
                  const regexMatch = filename.match(greedyRegex)
                  let foundInArray: any = null

                  if (regexMatch) {
                    const potentialId = regexMatch[2]
                    const found = otherMatch.find((r) => {
                      const id = (r.mod && r.mod.mod_id) || r.mod_id
                      return id && id.toString() === potentialId
                    })
                    if (found) {
                      foundInArray = found
                    }
                  }

                  if (!foundInArray && otherMatch.length > 0) {
                    // Priority 1: Exact File Name Match
                    const exactFileMatch = otherMatch.find(
                      (r) => r.file_details && r.file_details.file_name === filename
                    )

                    if (exactFileMatch) {
                      foundInArray = exactFileMatch
                    } else {
                      // Priority 2: Avoid "Guide" or "Modpack"
                      const betterMatch = otherMatch.find((r) => {
                        const name = (r.mod && r.mod.name) || ''
                        return (
                          !name.toLowerCase().includes('guide') &&
                          !name.toLowerCase().includes('pack')
                        )
                      })

                      if (betterMatch) {
                        foundInArray = betterMatch
                      } else {
                        // Default to first
                        foundInArray = otherMatch[0]
                      }
                    }
                  }

                  if (foundInArray) {
                    match = foundInArray
                  }
                }

                // Simplified extraction - similar to internal logic but we just need display info
                let foundMeta = {
                  name: (match.mod && match.mod.name) || match.name || 'Unknown Mod',
                  imageUrl: (match.mod && match.mod.picture_url) || match.picture_url,
                  summary: (match.mod && match.mod.summary) || match.summary,
                  nexusId: (match.mod && match.mod.mod_id) || match.mod_id,
                  author: (match.mod && match.mod.author) || match.author
                }

                throw new Error(`REDIRECT_GAME:${otherId}|||${JSON.stringify(foundMeta)}`)
              }
            } catch (e: any) {
              if (e.message.startsWith('REDIRECT_GAME')) throw e
              // Ignore other errors (api failure etc) during cross-check
            }
          }
        }
      } catch (e: any) {
        if (e.message.startsWith('REDIRECT_GAME') || e.message.includes('cancelled')) throw e
        hashCheckStatus = 'error'
        console.warn('Hash check failed', e)
      }
    } else {
      hashCheckStatus = 'skipped'
    }

    // 2. Plugin Custom Analysis (Type Detection & Metadata)
    try {
      const fileList = await listArchiveFiles(filePath)
      const customMeta = (await this.runCommand(gameId, 'analyzeArchive', fileList)) as any
      if (customMeta && typeof customMeta === 'object') {
        if (customMeta.type) type = customMeta.type

        // Plugin specific overrides
        if (customMeta.nexusDomain) nexusDomain = customMeta.nexusDomain
        if (customMeta.sourceUrl) sourceUrl = customMeta.sourceUrl
        if (customMeta.note) note = customMeta.note

        // Only use Plugin metadata assignments if we didn't identify via hash (or if duplicate check)
        // Actually, plugin might know better about 'Tool' types even if hash matched
        if (!hashMatchFound) {
          if (customMeta.nexusId) nexusId = customMeta.nexusId
          if (customMeta.version) version = customMeta.version
          if (customMeta.name) displayName = customMeta.name
          if (customMeta.author) author = customMeta.author
          if (customMeta.description) description = customMeta.description
          if (customMeta.imageUrl) imageUrl = customMeta.imageUrl
        }
      } else if (
        fileList.some(
          (f) => f.toLowerCase() === 'dinput8.dll' || f.toLowerCase().endsWith('dinput8.dll')
        ) ||
        filePath.toLowerCase().includes('loader')
      ) {
        type = 'loader'
      }
    } catch (e) {
      console.warn('Plugin analysis failed', e)
    }

    // 3. Regex Fallback (Only for Name/Version parsing, NOT for ID if Hash Check Failed)
    // If Hash Check was 'not-found', we DO NOT guess ID from filename to prevent cross-game errors.
    // If Hash Check was 'skipped' or 'error', we MAY guess ID as fallback.
    const allowRegexId = !nexusId && (hashCheckStatus === 'skipped' || hashCheckStatus === 'error')

    let remainder = filenameNoExt
    const duplicateMatch = remainder.match(/(.*)\s\(\d+\)$/)
    if (duplicateMatch) remainder = duplicateMatch[1]
    const tsMatch = remainder.match(/-(\d{9,})$/)
    if (tsMatch) remainder = remainder.substring(0, remainder.length - tsMatch[0].length)

    // Minimal Regex for Name/Version info
    const greedyRegex = /^(.*)-(\d+)-(.+)$/
    const match = remainder.match(greedyRegex)

    if (match) {
      const potentialName = match[1]
      // If we allow regex ID, use it. Otherwise ignore that group.
      const potentialId = match[2]
      const potentialVer = match[3]

      if (!displayName || displayName === filenameNoExt) displayName = potentialName

      if (allowRegexId && potentialId) {
        // Basic check: is it purely numeric?
        if (/^\d+$/.test(potentialId)) nexusId = potentialId
      }

      if (!version) version = potentialVer
    } else {
      const match2 = remainder.match(/^(.*)-(\d+)-(.+)$/)
      if (match2) {
        if (!displayName || displayName === filenameNoExt) displayName = match2[1]
        if (allowRegexId && match2[2]) nexusId = match2[2]
        if (!version) version = match2[3]
      }
    }

    // 4. Fetch Official Metadata if ID is known
    if (nexusId && this.nexusApiKey) {
      try {
        const slug = nexusDomain || this.getNexusSlug(gameId)
        const data = await fetchNexusMetadata(this.nexusApiKey, slug, nexusId)
        if (data) {
          displayName = data.name || displayName
          // Only use mod version if we didn't get version from file_details (hash match)
          if (!hashMatchFound) {
            version = data.version || version
          }
          author = data.uploaded_by || author
          description = data.summary || description
          imageUrl = data.picture_url || imageUrl
        }
      } catch (e: any) {
        console.warn('Failed to fetch Nexus metadata:', e.message)
      }
    }

    return {
      displayName,
      version,
      nexusId,
      author,
      description,
      imageUrl,
      sourceUrl,
      type,
      nexusDomain,
      note
    }
  }

  async installMod(
    gameId: string,
    zipPath: string,
    optionsOrAutoEnable:
      | boolean
      | {
          autoEnable?: boolean
          version?: string
          sourceUrl?: string
          nexusId?: string
          author?: string
          description?: string
          imageUrl?: string
          name?: string
        } = false
  ) {
    const gamePath = this.gamePaths[gameId]
    if (!gamePath) throw new Error('Game path not set')

    const options =
      typeof optionsOrAutoEnable === 'boolean'
        ? { autoEnable: optionsOrAutoEnable }
        : optionsOrAutoEnable

    const modId = path.parse(zipPath).name.replace(/\s+/g, '_')
    const modStagingPath = path.join(this.stagingDir, gameId, modId)

    if (fs.existsSync(modStagingPath)) fs.rmSync(modStagingPath, { recursive: true, force: true })
    fs.mkdirSync(modStagingPath, { recursive: true })

    await extractArchive(zipPath, modStagingPath)

    const {
      displayName,
      version,
      nexusId,
      author,
      description,
      imageUrl,
      sourceUrl,
      type,
      nexusDomain,
      note
    } = await this.resolveModMetadata(gameId, zipPath, options)

    // Double check specific files in extracted path if generic type
    let finalType = type

    // Try plugin-specific type detection on extracted files
    try {
      const detectedType = await this.runCommand(gameId, 'determineModType', modStagingPath)
      if (detectedType && typeof detectedType === 'string') {
        finalType = detectedType
      }
    } catch (e) {
      // Ignore if not implemented or fails
    }

    if (finalType === 'mod') {
      if (fs.existsSync(path.join(modStagingPath, 'dinput8.dll'))) {
        finalType = 'loader'
      }
    }

    const manifest = this.readManifest(gameId)

    // Check for existing mod to update/replace
    let modToReplaceId: string | null = null

    // 1. Try Nexus ID match
    if (nexusId) {
      const existing = manifest.mods.find((m) => m.nexusId === nexusId)
      if (existing) modToReplaceId = existing.id
    }

    // 2. If not found, try Name match
    if (!modToReplaceId) {
      const existing = manifest.mods.find((m) => m.name === displayName)
      if (existing) modToReplaceId = existing.id
    }

    if (modToReplaceId) {
      const existing = manifest.mods.find((m) => m.id === modToReplaceId)
      if (existing) {
        let shouldReplace = false
        // Condition 1: Missing Source
        if (existing.error === 'Source missing') {
          shouldReplace = true
        }
        // Condition 2: Version Upgrade (or just different version)
        else if (version && existing.version && version !== existing.version) {
          shouldReplace = true
        } else {
          // Default to replace for duplicates
          shouldReplace = true
        }

        if (shouldReplace) {
          // If ID is different, clean up the OLD staging folder
          if (modToReplaceId !== modId) {
            const oldStaging = path.join(this.stagingDir, gameId, modToReplaceId)
            if (fs.existsSync(oldStaging)) {
              try {
                fs.rmSync(oldStaging, { recursive: true, force: true })
              } catch {}
            }
          }
        } else {
          modToReplaceId = null
        }
      }
    }

    manifest.mods = manifest.mods.filter((m) => m.id !== modId && m.id !== modToReplaceId)
    manifest.mods.push({
      id: modId,
      name: displayName,
      author,
      description,
      imageUrl,
      enabled: false,
      installDate: Date.now(),
      files: [],
      type: finalType,
      version,
      nexusId,
      sourceUrl: sourceUrl || options.sourceUrl,
      note,
      nexusDomain
    })
    this.writeManifest(gameId, manifest)

    if (options.autoEnable) {
      await this.enableMod(gameId, modId)
    }
    return true
  }

  async enableMod(gameId: string, modId: string) {
    const manifest = this.readManifest(gameId)
    const mod = manifest.mods.find((m) => m.id === modId)
    if (!mod) return false
    if (mod.enabled) return true

    const modStagingPath = path.join(this.stagingDir, gameId, modId)
    
    if (!fs.existsSync(modStagingPath)) {
      throw new Error('Mod source files missing. Reinstall required.')
    }

    this.activeModId = modId

    const result = (await this.runCommand(
      gameId,
      'install',
      modStagingPath,
      this.gamePaths[gameId],
      modStagingPath
    )) as any

    // Re-read manifest as registerInstalledFile updates it
    const updatedManifest = this.readManifest(gameId)
    const updatedMod = updatedManifest.mods.find((m) => m.id === modId)
    if (updatedMod) {
      updatedMod.enabled = true
      if (result && typeof result === 'object') {
        if (result.note) updatedMod.note = result.note
        if (result.nexusId) updatedMod.nexusId = result.nexusId
        if (result.sourceUrl) updatedMod.sourceUrl = result.sourceUrl
        if (result.version) updatedMod.version = result.version
        if (result.author) updatedMod.author = result.author
        if (result.nexusDomain) updatedMod.nexusDomain = result.nexusDomain
      }
    }
    this.writeManifest(gameId, updatedManifest)

    this.activeModId = null
    return true
  }

  async enableAllMods(gameId: string) {
    const manifest = this.readManifest(gameId)
    const toEnable = manifest.mods.filter((m) => !m.enabled && m.error !== 'Source missing')

    for (const mod of toEnable) {
      await this.enableMod(gameId, mod.id)
    }
    return true
  }

  async disableMod(gameId: string, modId: string) {
    const manifest = this.readManifest(gameId)
    const mod = manifest.mods.find((m) => m.id === modId)
    if (!mod) return false

    if (mod.files && mod.files.length > 0) {
      for (const file of mod.files) {
        if (fs.existsSync(file)) {
          try {
            const stat = fs.lstatSync(file)
            if (stat.isDirectory()) {
              if (stat.isSymbolicLink()) fs.unlinkSync(file)
            } else {
              fs.unlinkSync(file)
            }
          } catch (e) {
            console.error(e)
          }
        }
      }
      mod.files = []
    }

    mod.enabled = false
    this.writeManifest(gameId, manifest)
    return true
  }

  async disableAllMods(gameId: string) {
    const manifest = this.readManifest(gameId)
    for (const mod of manifest.mods) {
      if (mod.enabled) {
        await this.disableMod(gameId, mod.id)
      }
    }
    return true
  }

  async deleteMod(gameId: string, modId: string) {
    await this.disableMod(gameId, modId)

    const modStagingPath = path.join(this.stagingDir, gameId, modId)
    if (fs.existsSync(modStagingPath)) {
      fs.rmSync(modStagingPath, { recursive: true, force: true })
    }

    const manifest = this.readManifest(gameId)
    manifest.mods = manifest.mods.filter((m) => m.id !== modId)
    this.writeManifest(gameId, manifest)
    return true
  }

  async getMods(gameId: string) {
    const mods = this.readManifest(gameId).mods
    return mods.sort((a, b) => {
      // Loaders first
      const aIsLoader = a.type?.toLowerCase() === 'loader'
      const bIsLoader = b.type?.toLowerCase() === 'loader'
      if (aIsLoader && !bIsLoader) return -1
      if (!aIsLoader && bIsLoader) return 1

      // Then Alphabetical
      return a.name.localeCompare(b.name)
    })
  }

  async checkModUpdate(gameId: string, modId: string) {
    const manifest = this.readManifest(gameId)
    const mod = manifest.mods.find((m) => m.id === modId)
    if (!mod) return { error: 'Mod not found' }

    const plugin = this.plugins.get(gameId)
    if (plugin && typeof (plugin as any).checkUpdate === 'function') {
      const modDTO = {
        id: mod.id,
        name: mod.name,
        version: mod.version,
        sourceUrl: mod.sourceUrl,
        nexusId: mod.nexusId
      }

      const result = (await this.runCommand(gameId, 'checkUpdate', modDTO)) as any

      // Only return if it explicitly supported the check, otherwise fall through to Nexus
      if (result && result.supported !== false) {
        if (result && typeof result === 'object') {
          return {
            supported: result.supported,
            error: result.error,
            updateAvailable: result.updateAvailable,
            latestVersion: result.latestVersion,
            downloadUrl: result.downloadUrl
          }
        }
        return result
      }
    }

    if (mod.nexusId && this.nexusApiKey) {
      return await checkNexusUpdate(
        this.nexusApiKey,
        this.getNexusSlug(gameId),
        mod.nexusId,
        mod.version
      )
    }

    return { error: 'Update check not supported by this game or mod' }
  }

  private getNexusSlug(gameId: string): string {
    const plugin = this.plugins.get(gameId)
    const sources = (plugin as any).modSources
    if (sources && Array.isArray(sources)) {
      const nexusSrc = sources.find((s) => s.url.includes('nexusmods.com'))
      if (nexusSrc) {
        const match = nexusSrc.url.match(/nexusmods\.com\/([^/]+)/)
        if (match) return match[1]
      }
    }
    return gameId // fallback
  }

  async analyzeFile(gameId: string, filePath: string) {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.modpack' || ext === '.pmm-pack' || ext === '.json') {
      try {
        const meta = await this.modpackManager.getModpackMetadata(filePath)
        return { type: 'modpack', meta }
      } catch {
        // Fallthrough
      }
    }

    try {
      const { displayName, version, nexusId, author, description, imageUrl, sourceUrl } =
        await this.resolveModMetadata(gameId, filePath)

      return {
        type: 'mod',
        meta: {
          name: displayName,
          version,
          nexusId,
          author,
          description,
          imageUrl,
          path: filePath,
          sourceUrl
        }
      }
    } catch (e: any) {
      if (e.message.startsWith('REDIRECT_GAME:')) {
        const parts = e.message.split('|||')
        const mainPart = parts[0].replace('REDIRECT_GAME:', '')
        const metaPart = parts[1]
        let meta = null
        try {
          meta = JSON.parse(metaPart)
        } catch {}

        return { type: 'redirect', gameId: mainPart, meta }
      }
      throw e
    }
  }

  async _fetchNexusMetadata(gameId: string, nexusId: string) {
    if (!this.nexusApiKey) return null
    return fetchNexusMetadata(this.nexusApiKey, this.getNexusSlug(gameId), nexusId)
  }

  async validateGame(gameId: string) {
    try {
      let result = (await this.runCommand(
        gameId,
        'checkRequirements',
        this.gamePaths[gameId]
      )) as any

      const manifest = this.readManifest(gameId)
      const loaders = manifest.mods.filter((m) => m.type?.toLowerCase() === 'loader')
      const hasBrokenLoaders = loaders.some((m) => m.error === 'Source missing')

      // Auto-Repair Logic
      const shouldRepair = hasBrokenLoaders || (result && result.valid === false && !loaders.length)

      if (shouldRepair && !this.repairedGames.has(gameId) && manifest.managed) {
        console.log(`[AutoRepair] Requirements missing for ${gameId}. Attempting auto-repair...`)
        this.emit('auto-repair-started', { gameId })
        this.repairedGames.add(gameId)
        try {
          await this.runCommand(gameId, 'prepareForModding', this.gamePaths[gameId])
          // Re-check after repair
          result = (await this.runCommand(
            gameId,
            'checkRequirements',
            this.gamePaths[gameId]
          )) as any
        } catch (e) {
          console.error(`[AutoRepair] Failed:`, e)
        } finally {
          this.emit('auto-repair-finished', { gameId })
        }
      }

      if (result && typeof result === 'object' && 'valid' in result) {
        // Clone to plain object to avoid IPC cloning errors with VM2 proxies
        let links: any[] | undefined
        if (result.links && typeof result.links.length === 'number') {
          links = []
          for (let i = 0; i < result.links.length; i++) {
            const l = result.links[i]
            links.push({ text: l.text, url: l.url })
          }
        }

        return {
          valid: result.valid,
          message: result.message,
          link: result.link,
          linkText: result.linkText,
          links
        }
      }
      if (result === false) return { valid: false, message: 'Requirements not met' }
      return { valid: true }
    } catch (e) {
      return { valid: true }
    }
  }

  public async runCommand(pluginId: string, command: string, ...args: any[]) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`)

    let gamePath = this.gamePaths[pluginId] || null
    if (command === 'detect') gamePath = 'SAFE_MODE_DETECT'

    const mainFile = this.pluginFiles.get(pluginId)
    if (!mainFile) throw new Error(`Plugin file not found for ${pluginId}`)

    // Save previous context
    const previousGamePath = this.activeGamePath
    const previousGameId = this.activeGameId
    const previousPluginPath = this.currentPluginPath

    this.activeGamePath = gamePath
    this.activeGameId = pluginId
    this.currentPluginPath = mainFile
    this.sandboxErrors = [] // Reset error tracking for this command

    // NOTE: In true async context re-entrance, this global state strategy is dangerous.
    // For now, staying consistent with single-threaded JS node event loop.

    try {
      if (typeof plugin[command] === 'function') {
        const result = await plugin[command](...args)
        return result
      } else {
        return null
      }
    } finally {
      // Restore previous context
      this.activeGamePath = previousGamePath
      this.activeGameId = previousGameId
      this.currentPluginPath = previousPluginPath
    }
  }

  loadPlugins() {
    this.plugins.clear()
    this.pluginFiles.clear()
    if (!fs.existsSync(this.pluginsDir)) return

    const items = fs.readdirSync(this.pluginsDir)
    items.forEach((item) => {
      const fullPath = path.join(this.pluginsDir, item)
      const stats = fs.lstatSync(fullPath)
      let pluginFile: string | null = null

      if (
        item.endsWith('.js.disabled') ||
        (stats.isDirectory() && fs.existsSync(path.join(fullPath, 'index.js.disabled')))
      ) {
        return
      }

      if (stats.isDirectory()) {
        const index = path.join(fullPath, 'index.js')
        if (fs.existsSync(index)) pluginFile = index
      } else if (item.endsWith('.js')) {
        pluginFile = fullPath
      }

      if (pluginFile) {
        try {
          const code = fs.readFileSync(pluginFile, 'utf8')
          const sandboxObj = this.createSandbox() as any
          sandboxObj.sandbox = sandboxObj

          const vm = new NodeVM({
            console: 'redirect',
            sandbox: sandboxObj,
            require: { external: true, builtin: ['path'] }
          })

          const pluginExports = vm.run(code, pluginFile)
          const plugin = pluginExports.default || pluginExports
          if (plugin && plugin.id) {
            const safeId = String(plugin.id)
            this.plugins.set(safeId, plugin)
            this.pluginFiles.set(safeId, pluginFile)
          }
        } catch (err) {
          console.error(err)
        }
      }
    })
  }

  async getExtensionList() {
    const result: any[] = []

    const extractName = (source: string): string | null => {
      const match = source.match(/name\s*:\s*(['"`])(.*?)\1/)
      return match ? match[2] : null
    }

    for (const [id, plugin] of this.plugins.entries()) {
      const file = this.pluginFiles.get(id)
      if (file) {
        result.push({
          id: id,
          name: plugin.name,
          description: (plugin as any).description || '',
          enabled: true,
          path: file,
          version: (plugin as any).version || '1.0.0',
          author: (plugin as any).author || 'Unknown'
        })
      }
    }

    if (fs.existsSync(this.pluginsDir)) {
      const items = fs.readdirSync(this.pluginsDir)
      items.forEach((item) => {
        const fullPath = path.join(this.pluginsDir, item)
        if (item.endsWith('.js.disabled')) {
          const potentialId = item.replace('.js.disabled', '')
          let name = potentialId + ' (Disabled)'
          try {
            if (fs.existsSync(fullPath)) {
              const content = fs.readFileSync(fullPath, 'utf-8')
              const extracted = extractName(content)
              if (extracted) name = extracted + ' (Disabled)'
            }
          } catch (e) {}

          result.push({
            id: potentialId,
            name: name,
            enabled: false,
            path: fullPath
          })
        } else if (fs.lstatSync(fullPath).isDirectory()) {
          if (fs.existsSync(path.join(fullPath, 'index.js.disabled'))) {
            const indexPath = path.join(fullPath, 'index.js.disabled')
            let name = item + ' (Disabled)'
            try {
              const content = fs.readFileSync(indexPath, 'utf-8')
              const extracted = extractName(content)
              if (extracted) name = extracted + ' (Disabled)'
            } catch (e) {}

            result.push({
              id: item,
              name: name,
              enabled: false,
              path: indexPath
            })
          }
        }
      })
    }
    return result
  }

  async toggleExtension(id: string, enabled: boolean) {
    let targetPath: string | null = this.pluginFiles.get(id) || null

    if (enabled && !targetPath) {
      if (fs.existsSync(this.pluginsDir)) {
        const items = fs.readdirSync(this.pluginsDir)
        for (const item of items) {
          if (item === id + '.js.disabled') {
            targetPath = path.join(this.pluginsDir, item)
            break
          }
          const fullPath = path.join(this.pluginsDir, item)
          if (fs.lstatSync(fullPath).isDirectory()) {
            if (fs.existsSync(path.join(fullPath, 'index.js.disabled'))) {
              // ...
            }
          }
        }
      }
    }

    if (!targetPath) return false

    try {
      const newPath = enabled ? targetPath.replace('.disabled', '') : targetPath + '.disabled'
      fs.renameSync(targetPath, newPath)
      this.loadPlugins()
      return true
    } catch (e) {
      console.error('Failed to toggle extension', e)
      return false
    }
  }

  async deleteExtension(id: string) {
    let targetPath: string | null = this.pluginFiles.get(id) || null
    if (!targetPath) {
      if (fs.existsSync(path.join(this.pluginsDir, id + '.js.disabled'))) {
        targetPath = path.join(this.pluginsDir, id + '.js.disabled')
      }
    }

    if (!targetPath) return false

    try {
      const parentDir = path.dirname(targetPath)
      if (path.basename(targetPath).startsWith('index.js')) {
        if (path.resolve(path.dirname(parentDir)) === path.resolve(this.pluginsDir)) {
          fs.rmSync(parentDir, { recursive: true, force: true })
        }
      } else {
        fs.unlinkSync(targetPath)
      }
      this.loadPlugins()
      return true
    } catch (e) {
      return false
    }
  }

  getPlugins() {
    return this.getGamesInternal()
  }

  getSupportedExtensions(gameId: string): string[] {
    const plugin = this.plugins.get(gameId)
    const exts = (plugin as any)?.modFileExtensions
    if (exts) {
      try {
        const arr = Array.from(exts) as string[]
        if (arr.length > 0) return arr
      } catch (e) {
        console.warn('Failed to convert modFileExtensions to array', e)
      }
    }
    return ['zip', 'rar', '7z', 'mod']
  }

  async installExtension(zipPath: string) {
    const zip = new AdmZip(zipPath)
    const tempDir = path.join(app.getPath('temp'), 'ext_' + Date.now())
    try {
      zip.extractAllTo(tempDir, true)
      const files = fs.readdirSync(tempDir)
      const extName = path.parse(zipPath).name
      const targetDir = path.join(this.pluginsDir, extName)
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true })
      fs.mkdirSync(targetDir, { recursive: true })

      const copyRec = (src, dest) => {
        if (fs.lstatSync(src).isDirectory()) {
          fs.mkdirSync(dest, { recursive: true })
          fs.readdirSync(src).forEach((child) =>
            copyRec(path.join(src, child), path.join(dest, child))
          )
        } else {
          fs.copyFileSync(src, dest)
        }
      }
      let sourceDir = tempDir
      if (files.length === 1 && fs.lstatSync(path.join(tempDir, files[0])).isDirectory()) {
        sourceDir = path.join(tempDir, files[0])
      }
      copyRec(sourceDir, targetDir)
      this.loadPlugins()
      return true
    } catch (e) {
      return false
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  async exportExtension(pluginId: string): Promise<Buffer | null> {
    const mainFile = this.pluginFiles.get(pluginId)
    if (!mainFile) return null

    const zip = new AdmZip()

    if (path.basename(mainFile) === 'index.js') {
      const pluginDir = path.dirname(mainFile)
      zip.addLocalFolder(pluginDir)
    } else {
      zip.addLocalFile(mainFile)
    }

    return zip.toBuffer()
  }

  async exportExtensionsBulk(ids: string[]): Promise<Buffer | null> {
    const zip = new AdmZip()
    for (const id of ids) {
      const file = this.pluginFiles.get(id)
      if (file) {
        if (path.basename(file) === 'index.js') {
          const dir = path.dirname(file)
          zip.addLocalFolder(dir, path.basename(dir))
        } else {
          zip.addLocalFile(file)
        }
      } else {
        if (fs.existsSync(path.join(this.pluginsDir, id + '.js.disabled'))) {
          zip.addLocalFile(path.join(this.pluginsDir, id + '.js.disabled'))
        }
      }
    }
    return zip.toBuffer()
  }

  private extractPluginMetadataFromSource(source: string) {
    const extract = (key: string) => {
      const regex = new RegExp(`${key}\\s*:\\s*(['"\`])(.*?)\\1`)
      const match = source.match(regex)
      return match ? match[2] : null
    }

    return {
      id: extract('id'),
      name: extract('name'),
      version: extract('version'),
      author: extract('author'),
      description: extract('description'),
      iconUrl: extract('iconUrl'),
      // iconUrl might be a property or part of the object. 
      // This simple regex works for simple object properties.
    }
  }

  async getPluginMetadata(filePath: string) {
    try {
      const zip = new AdmZip(filePath)
      const entries = zip.getEntries()
      
      // Look for index.js in a root folder, or a root .js file
      let targetEntry: any = null
      
      // 1. Check for Root Folder with index.js
      // e.g. "subnautica/index.js"
      for (const entry of entries) {
        if (entry.entryName.match(/^[^/]+\/index\.js$/)) {
          targetEntry = entry
          break
        }
      }

      // 2. Check for root .js file
      if (!targetEntry) {
        for (const entry of entries) {
          if (!entry.entryName.includes('/') && entry.entryName.endsWith('.js')) {
            targetEntry = entry
            break
          }
        }
      }

      if (targetEntry) {
        const content = targetEntry.getData().toString('utf8')
        const meta = this.extractPluginMetadataFromSource(content)
        return { ...meta, valid: true }
      }
      
      return { valid: false, error: 'No valid plugin file found in archive' }
    } catch (e) {
      console.error('Failed to read plugin metadata', e)
      return { valid: false, error: 'Failed to read file' }
    }
  }

  async previewExtensionPackage(zipPath: string) {
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const extensions: any[] = []

    for (const entry of entries) {
      if (entry.isDirectory) continue

      if (!entry.entryName.includes('/') && entry.entryName.endsWith('.js')) {
        extensions.push({
          type: 'file',
          path: entry.entryName,
          name: entry.entryName.replace('.js', '')
        })
      } else if (entry.entryName.match(/^[^/]+\/index\.js$/)) {
        const folder = entry.entryName.split('/')[0]
        extensions.push({
          type: 'folder',
          path: folder,
          name: folder
        })
      }
    }
    return extensions
  }

  async installSelectedExtensions(zipPath: string, selectedPaths: string[]) {
    const zip = new AdmZip(zipPath)

    try {
      for (const target of selectedPaths) {
        const entry = zip.getEntry(target)
        if (entry) {
          zip.extractEntryTo(target, this.pluginsDir, false, true)
        } else {
          const folderEntries = zip.getEntries().filter((e) => e.entryName.startsWith(target + '/'))
          folderEntries.forEach((e) => {
            zip.extractEntryTo(e, this.pluginsDir, true, true)
          })
        }
      }
      this.loadPlugins()
      return true
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  // Wrappers to ModpackManager
  async createModpack(gameId: string, meta: any, destPath: string) {
    return this.modpackManager.createModpack(gameId, meta, destPath)
  }

  async getModpackMetadata(modpackPath: string) {
    return this.modpackManager.getModpackMetadata(modpackPath)
  }

  async installModpack(modpackPath: string) {
    return this.modpackManager.installModpack(modpackPath)
  }
}
