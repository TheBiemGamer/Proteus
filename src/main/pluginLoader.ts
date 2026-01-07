import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { NodeVM } from 'vm2'
import AdmZip from 'adm-zip'
import axios from 'axios'
import { IGameExtension, IMod } from '../shared/types'
import { listArchiveFiles, extractArchive } from './utils/archives'
import { fetchNexusMetadata, checkNexusUpdate } from './utils/nexus'
import { ModpackManager } from './features/modpack'

interface GameManifest {
  mods: IMod[]
  managed: boolean
}

export class PluginManager {
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

  private modpackManager: ModpackManager

  constructor(appPath: string) {
    this.pluginsDir = path.join(appPath, 'plugins')
    this.stagingDir = path.join(app.getPath('userData'), 'Staging')

    if (!fs.existsSync(this.pluginsDir)) fs.mkdirSync(this.pluginsDir)
    if (!fs.existsSync(this.stagingDir)) fs.mkdirSync(this.stagingDir)

    const userData = app.getPath('userData')
    this.settingsPath = path.join(userData, 'game-paths.json')

    this.loadSettings()

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
    return path.join(gamePath, 'modmanager.json')
  }

  private readManifest(gameId: string): GameManifest {
    const manifestPath = this.getManifestPath(gameId)
    if (!manifestPath || !fs.existsSync(manifestPath)) {
      return { mods: [], managed: false }
    }
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch {
      return { mods: [], managed: false }
    }
  }

  private writeManifest(gameId: string, data: GameManifest) {
    const manifestPath = this.getManifestPath(gameId)
    if (manifestPath) {
      fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2))
    }
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

  private nexusApiKey: string | null = null

  public setNexusApiKey(key: string | undefined) {
    this.nexusApiKey = key || null
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

          try {
            const stat = fs.lstatSync(src)
            if (stat.isDirectory()) {
              fs.symlinkSync(src, dest, 'junction')
            } else {
              try {
                fs.symlinkSync(src, dest, 'file')
              } catch (err) {
                try {
                  const srcRoot = path.parse(src).root
                  const destRoot = path.parse(dest).root
                  if (srcRoot.toLowerCase() === destRoot.toLowerCase()) {
                    fs.linkSync(src, dest)
                  } else {
                    throw new Error('Cross-device link')
                  }
                } catch {
                  console.warn(`Link failed for ${dest}, falling back to copy.`)
                  fs.copyFileSync(src, dest)
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
            console.error('Fetch failed', e)
            throw e
          }
        },
        downloadFile: async (url: string, dest: string) => {
          if (!this.isSafePath(dest)) throw new Error(`Access Denied: ${dest}`)
          try {
            const response = await axios({ url, method: 'GET', responseType: 'stream' })
            const writer = fs.createWriteStream(dest)
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

  async autoDetectGames() {
    const candidates = [
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
    } catch (e) {
      console.warn(`[PM] prepareForModding failed for ${gameId}`, e)
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

    let manifest = this.readManifest(gameId)

    let type: 'mod' | 'loader' | string = 'mod'
    let version: string | undefined
    let nexusId: string | undefined
    let author = 'Unknown'
    let description: string | undefined
    let imageUrl: string | undefined
    let sourceUrl: string | undefined
    let note: string | undefined

    const filenameNoExt = path.parse(zipPath).name
    let displayName = filenameNoExt
    if (options.name) displayName = options.name

    // 1. Regex Parsing
    let remainder = filenameNoExt
    const duplicateMatch = remainder.match(/(.*)\s\(\d+\)$/)
    if (duplicateMatch) remainder = duplicateMatch[1]
    const tsMatch = remainder.match(/-(\d{9,})$/)
    if (tsMatch) remainder = remainder.substring(0, remainder.length - tsMatch[0].length)

    const greedyRegex = /^(.*)-(\d+)-(.+)$/
    let match = remainder.match(greedyRegex)

    if (match) {
      let potentialName = match[1]
      let potentialId = match[2]
      let potentialVer = match[3]
      for (let i = 0; i < 5; i++) {
        const suffixMatch = potentialName.match(/-(\d+)$/)
        if (suffixMatch) {
          potentialVer = `${potentialId}-${potentialVer}`
          potentialId = suffixMatch[1]
          potentialName = potentialName.substring(0, potentialName.length - suffixMatch[0].length)
        } else {
          break
        }
      }
      displayName = potentialName
      nexusId = potentialId
      version = potentialVer
      if (/^\d+(-\d+)+$/.test(version)) version = version.replace(/-/g, '.')
    } else {
      const match2 = remainder.match(/^(.*)-(\d+)-(.+)$/)
      if (match2) {
        displayName = match2[1]
        nexusId = match2[2]
        version = match2[3]
      }
    }

    let nexusDomain: string | undefined

    // 2. Plugin Custom Logic
    const customType = (await this.runCommand(gameId, 'determineModType', modStagingPath)) as any
    if (customType) {
      if (typeof customType === 'string') {
        type = customType
      } else if (typeof customType === 'object') {
        if (customType.type) type = customType.type
        if (customType.nexusId) nexusId = customType.nexusId
        if (customType.sourceUrl) sourceUrl = customType.sourceUrl
        if (customType.version) version = customType.version
        if (customType.author) author = customType.author
        if (customType.note) note = customType.note
        if (customType.nexusDomain) nexusDomain = customType.nexusDomain
      }
    } else if (
      fs.existsSync(path.join(modStagingPath, 'dinput8.dll')) ||
      zipPath.toLowerCase().includes('loader')
    ) {
      type = 'loader'
    }

    if ((options as any).author) author = (options as any).author
    if ((options as any).description) description = (options as any).description
    if ((options as any).imageUrl) imageUrl = (options as any).imageUrl
    if (options.version) version = options.version
    if (options.nexusId) nexusId = options.nexusId

    if (nexusId && this.nexusApiKey) {
      try {
        const slug = nexusDomain || this.getNexusSlug(gameId)
        const data = await fetchNexusMetadata(this.nexusApiKey, slug, nexusId)
        if (data) {
          if (data.name && !options.name) displayName = data.name
          if (data.version && !options.version) version = data.version
          if (data.uploaded_by) author = data.uploaded_by
          if (data.summary) description = data.summary
          if (data.picture_url) imageUrl = data.picture_url
        }
      } catch (e: any) {
        console.warn('Failed to fetch Nexus metadata:', e.message)
      }
    }

    manifest.mods = manifest.mods.filter((m) => m.id !== modId)
    manifest.mods.push({
      id: modId,
      name: displayName,
      author,
      description,
      imageUrl,
      enabled: false,
      installDate: Date.now(),
      files: [],
      type,
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

    let manifest = this.readManifest(gameId)
    manifest.mods = manifest.mods.filter((m) => m.id !== modId)
    this.writeManifest(gameId, manifest)
    return true
  }

  async getMods(gameId: string) {
    return this.readManifest(gameId).mods
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

    if (ext === '.modpack' || ext === '.json') {
      try {
        const meta = await this.modpackManager.getModpackMetadata(filePath)
        return { type: 'modpack', meta }
      } catch {
        // Fallthrough
      }
    }

    const filenameNoExt = path.parse(filePath).name
    let displayName = filenameNoExt
    let nexusId: string | undefined
    let version: string | undefined
    let author: string | undefined
    let description: string | undefined
    let imageUrl: string | undefined
    let nexusDomain: string | undefined
    let sourceUrl: string | undefined

    try {
      const fileList = await listArchiveFiles(filePath)
      const customMeta = (await this.runCommand(gameId, 'analyzeArchive', fileList)) as any
      if (customMeta && typeof customMeta === 'object') {
        if (customMeta.type) displayName = customMeta.type
        if (customMeta.name) displayName = customMeta.name
        if (customMeta.nexusId) nexusId = customMeta.nexusId
        if (customMeta.version) version = customMeta.version
        if (customMeta.author) author = customMeta.author
        if (customMeta.nexusDomain) nexusDomain = customMeta.nexusDomain
        if (customMeta.sourceUrl) sourceUrl = customMeta.sourceUrl
        if (customMeta.description) description = customMeta.description
        if (customMeta.imageUrl) imageUrl = customMeta.imageUrl
      }
    } catch (e) {
      console.warn('Archive analysis failed:', e)
    }

    let remainder = filenameNoExt
    const duplicateMatch = remainder.match(/(.*)\s\(\d+\)$/)
    if (duplicateMatch) remainder = duplicateMatch[1]

    const tsMatch = remainder.match(/-(\d{9,})$/)
    if (tsMatch) remainder = remainder.substring(0, remainder.length - tsMatch[0].length)

    const greedyRegex = /^(.*)-(\d+)-(.+)$/
    let match = remainder.match(greedyRegex)
    if (match) {
      let potentialName = match[1]
      let potentialId = match[2]
      let potentialVer = match[3]

      for (let i = 0; i < 5; i++) {
        const suffixMatch = potentialName.match(/-(\d+)$/)
        if (suffixMatch) {
          potentialVer = `${potentialId}-${potentialVer}`
          potentialId = suffixMatch[1]
          potentialName = potentialName.substring(0, potentialName.length - suffixMatch[0].length)
        } else break
      }
      displayName = potentialName
      nexusId = potentialId
      version = potentialVer
      if (/^\d+(-\d+)+$/.test(version)) version = version.replace(/-/g, '.')
    } else {
      const match2 = remainder.match(/^(.*)-(\d+)-(.+)$/)
      if (match2) {
        displayName = match2[1]
        nexusId = match2[2]
        version = match2[3]
      }
    }

    if (nexusId && this.nexusApiKey) {
      try {
        const slug = nexusDomain || this.getNexusSlug(gameId)
        const data = await fetchNexusMetadata(this.nexusApiKey, slug, nexusId)
        if (data) {
          if (data.name) displayName = data.name
          if (data.version) version = data.version
          if (data.uploaded_by) author = data.uploaded_by
          if (data.summary) description = data.summary
          if (data.picture_url) imageUrl = data.picture_url
        }
      } catch (e: any) {
        console.warn('Failed to fetch Nexus metadata during analysis:', e.message)
      }
    }

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
  }

  async _fetchNexusMetadata(gameId: string, nexusId: string) {
    if (!this.nexusApiKey) return null
    return fetchNexusMetadata(this.nexusApiKey, this.getNexusSlug(gameId), nexusId)
  }

  async validateGame(gameId: string) {
    try {
      const result = (await this.runCommand(
        gameId,
        'checkRequirements',
        this.gamePaths[gameId]
      )) as any
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

  public runCommand(pluginId: string, command: string, ...args: any[]) {
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

    // NOTE: In true async context re-entrance, this global state strategy is dangerous.
    // For now, staying consistent with single-threaded JS node event loop.

    return new Promise(async (resolve, reject) => {
      try {
        if (typeof plugin[command] === 'function') {
          const result = await plugin[command](...args)
          resolve(result)
        } else {
          resolve(null)
        }
      } catch (e) {
        reject(e)
      } finally {
        // Restore previous context
        this.activeGamePath = previousGamePath
        this.activeGameId = previousGameId
        this.currentPluginPath = previousPluginPath
      }
    })
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
      const extName = path.basename(zipPath, '.modmanager').replace('.zip', '')
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
