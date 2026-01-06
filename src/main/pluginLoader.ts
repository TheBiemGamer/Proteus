import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { NodeVM } from 'vm2'
import AdmZip from 'adm-zip'
import axios from 'axios'
import sevenBin from '7zip-bin'
import Seven from 'node-7z'
import { IGameExtension, IMod } from '../shared/types'

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

  constructor(appPath: string) {
    this.pluginsDir = path.join(appPath, 'plugins')
    this.stagingDir = path.join(app.getPath('userData'), 'Staging')

    if (!fs.existsSync(this.pluginsDir)) fs.mkdirSync(this.pluginsDir)
    if (!fs.existsSync(this.stagingDir)) fs.mkdirSync(this.stagingDir)

    const userData = app.getPath('userData')
    this.settingsPath = path.join(userData, 'game-paths.json')

    this.loadSettings()
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

    // Case-insensitive check for Windows to avoid drive letter casing issues
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
        // Unzip logic handled by PluginManager mostly now, but keep for utils
        unzipFile: (zipPath: string, dest: string) => {
          // Generally unsafe if dest not checked?
          // For now allow, assuming plugin is trusted or operates in valid paths
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
                // Try Hard Link if on same drive
                try {
                  const srcRoot = path.parse(src).root
                  const destRoot = path.parse(dest).root
                  if (srcRoot.toLowerCase() === destRoot.toLowerCase()) {
                    fs.linkSync(src, dest)
                    // console.log(`Hardlinked ${dest}`)
                  } else {
                    throw new Error('Different drives')
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
          // Allow plugins to register "virtual" or auto-installed mods into the manifest
          if (!this.activeGameId) return
          const manifest = this.readManifest(this.activeGameId)
          // Avoid duplicates
          const existing = manifest.mods.find((m) => m.id === mod.id)
          if (!existing) {
            manifest.mods.push(mod)
            this.writeManifest(this.activeGameId, manifest)
          }
        },
        installMod: async (zipPath: string, options?: { autoEnable?: boolean }) => {
          if (!this.activeGameId) throw new Error('No active game')
          // Call the main installMod function
          // We pass the zip path (which should be in a safe temp location or similar)
          return self.installMod(this.activeGameId, zipPath, options?.autoEnable)
        },
        openUrl: async (url: string) => {
          await require('electron').shell.openExternal(url)
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
    // Return UI structure: includes 'managed' state
    return this.getGamesInternal()
  }

  private getGamesInternal() {
    const result: any[] = []
    // Convert Map keys to array to avoid any iteration weirdness, though strict strings should be fine.
    for (const [key, plugin] of Array.from(this.plugins.entries())) {
      const id = String(key) // Ensure ID is string
      if (this.gamePaths[id]) {
        const manifest = this.readManifest(id)
        
        // Safely extract properties from vm2 proxy
        // Force primitives to avoid proxy leakage
        const name = String(plugin.name)
        const steamAppId = plugin.steamAppId ? String(plugin.steamAppId) : undefined
        
        let modSources: { text: string; url: string }[] | undefined
        // Access safely
        try {
          const rawSources = (plugin as any).modSources
          if (Array.isArray(rawSources)) {
            // Explicitly map and stringify properties
            modSources = rawSources.map((s: any) => ({ 
              text: String(s.text), 
              url: String(s.url) 
            }))
          }
        } catch (e) {
          // If accessing modSources fails, just ignore it
          modSources = undefined
        }

        result.push({
          id,
          name,
          detected: true,
          managed: manifest.managed,
          path: this.gamePaths[id],
          steamAppId,
          modSources
        })
      }
    }
    // Deep clone via JSON to strip any remaining Proxy wrappers that IPC hates
    return JSON.parse(JSON.stringify(result))
  }

  // Called by UI when user clicks "Manage"
  async manageGame(gameId: string) {
    if (!this.gamePaths[gameId]) throw new Error('Game path not known')

    // 1. Mark managed
    let manifest = this.readManifest(gameId)
    manifest.managed = true
    this.writeManifest(gameId, manifest)

    // Plugin Hook: Prepare For Modding (e.g. downloading Loaders/SDKs)
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

    return this.getGamesInternal()
  }

  async unmanageGame(gameId: string) {
    if (!this.gamePaths[gameId]) throw new Error('Game path not known')

    // 1. Disable all mods (restores vanilla state roughly)
    await this.disableAllMods(gameId)

    // 2. Nuke Staging Directory for this game
    const gameStagingDir = path.join(this.stagingDir, gameId)
    if (fs.existsSync(gameStagingDir)) {
      try {
        fs.rmSync(gameStagingDir, { recursive: true, force: true })
      } catch (e) {
        console.error('Failed to remove staging dir', e)
      }
    }

    // 3. Remove Manifest File
    const manifestPath = this.getManifestPath(gameId)
    if (manifestPath && fs.existsSync(manifestPath)) {
      try {
        fs.unlinkSync(manifestPath)
      } catch (e) {
        console.error('Failed to remove manifest', e)
      }
    }

    return this.getGamesInternal()
  }

  private get7zBinary(): string {
    const isWin = process.platform === 'win32'
    if (isWin) {
      // Check common installation paths for full 7-Zip (supports RAR)
      const possiblePaths = [
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7z.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe')
      ]
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p
      }
    }
    // Fallback to bundled 7za (No RAR support)
    return sevenBin.path7za
  }

  private async extractArchive(src: string, dest: string): Promise<void> {
    const ext = path.extname(src).toLowerCase()

    // If it's not a known archive format, assume it's a single file mod
    if (!['.zip', '.rar', '.7z', '.mod'].includes(ext)) {
      const fileName = path.basename(src)
      fs.copyFileSync(src, path.join(dest, fileName))
      return
    }

    // Prefer AdmZip for pure zips/mods as it is faster/sync (though we wrap in async here)
    if (ext === '.zip' || ext === '.mod') {
      try {
        const zip = new AdmZip(src)
        zip.extractAllTo(dest, true)
        return
      } catch (e) {
        console.warn('AdmZip failed, trying 7zip fallback', e)
        // Fallthrough to 7zip
      }
    }

    const bin = this.get7zBinary()

    // Warning for RAR if no system 7z
    if (ext === '.rar' && bin.endsWith('7za.exe')) {
      console.warn('Attempting to extract RAR with 7za.exe. This usually fails. Install 7-Zip.')
    }

    // 7zip extraction for rar, 7z, or failed zips
    return new Promise((resolve, reject) => {
      const stream = Seven.extractFull(src, dest, {
        $bin: bin
      })
      stream.on('end', () => resolve())
      stream.on('error', (err: any) => {
        // Improve Error Message for RAR
        if (ext === '.rar' && bin.endsWith('7za.exe')) {
          reject(
            new Error(
              'Failed to extract .rar file. Please install 7-Zip (64-bit) in the default location to support RAR archives.'
            )
          )
        } else {
          // Log stderr for debugging
          if (err.stderr) console.error('7z Stderr:', err.stderr)
          reject(err)
        }
      })
    })
  }

  async installMod(gameId: string, zipPath: string, autoEnable = false) {
    const gamePath = this.gamePaths[gameId]
    if (!gamePath) throw new Error('Game path not set')

    // Use parse to handle any extension
    const modId = path.parse(zipPath).name.replace(/\s+/g, '_')
    const modStagingPath = path.join(this.stagingDir, gameId, modId)

    if (fs.existsSync(modStagingPath)) fs.rmSync(modStagingPath, { recursive: true, force: true })
    fs.mkdirSync(modStagingPath, { recursive: true })

    await this.extractArchive(zipPath, modStagingPath)

    let manifest = this.readManifest(gameId)

    // Determine type
    let type: 'mod' | 'loader' | string = 'mod'

    // Check if plugin has custom type logic
    const customType = await this.runCommand(gameId, 'determineModType', modStagingPath)
    if (customType && typeof customType === 'string') {
      type = customType
    } else if (
      fs.existsSync(path.join(modStagingPath, 'dinput8.dll')) ||
      zipPath.toLowerCase().includes('loader')
    ) {
      type = 'loader'
    }

    // Refresh Validation (in case this WAS the loader)
    // We don't need explicit logic here because the UI will call validateGame after install

    // Parse Nexus Filename Metadata
    const filenameNoExt = path.parse(zipPath).name
    let displayName = filenameNoExt
    let version: string | undefined
    let nexusId: string | undefined

    // Pattern: Name-ID-Version-Timestamp
    // Heuristic: We need to handle "greedy" names consuming the ID if the version contains hyphens.
    // Logic:
    // 1. Extract and remove Timestamp (digits at end)
    // 2. Parse remainder as Name-ID-Version using the "Left-most ID" principle for ambiguity.

    // Step 1: Timestamp
    let remainder = filenameNoExt

    // Handle OS Duplicate filenames " (1)" e.g. "ModName-123-1.0-123456 (1)"
    const duplicateMatch = remainder.match(/(.*)\s\(\d+\)$/)
    if (duplicateMatch) {
      remainder = duplicateMatch[1]
    }

    // Check for timestamp at end (digits preceded by hyphen)
    // IMPORTANT: Nexus timestamps are usually 10 digits (epoch).
    // If it's short, it might be a version number like -v1.
    const tsMatch = remainder.match(/-(\d{9,})$/)
    if (tsMatch) {
      remainder = remainder.substring(0, remainder.length - tsMatch[0].length)
    }

    // Step 2: Parse Name-ID-Version
    // We start with a greedy match of Name, then peal back if Name ends in "-Digits"
    const greedyRegex = /^(.*)-(\d+)-(.+)$/
    let match = remainder.match(greedyRegex)

    if (match) {
      let potentialName = match[1]
      let potentialId = match[2]
      let potentialVer = match[3]

      // Correction Loop
      for (let i = 0; i < 5; i++) {
        const suffixMatch = potentialName.match(/-(\d+)$/)
        if (suffixMatch) {
          const suffixDigits = suffixMatch[1]
          // Shift right
          potentialVer = `${potentialId}-${potentialVer}`
          potentialId = suffixDigits
          potentialName = potentialName.substring(0, potentialName.length - suffixMatch[0].length)
        } else {
          break
        }
      }

      displayName = potentialName
      nexusId = potentialId
      version = potentialVer

      // Normalize numeric-hyphen versions
      if (/^\d+(-\d+)+$/.test(version)) {
        version = version.replace(/-/g, '.')
      }
    } else {
      // Fallback: match without timestamp
      // Try just Name-ID-Version
      const greedyRegex = /^(.*)-(\d+)-(.+)$/
      let match2 = remainder.match(greedyRegex)
      if (match2) {
        displayName = match2[1]
        nexusId = match2[2]
        version = match2[3]
      }
    }

    // Update list
    manifest.mods = manifest.mods.filter((m) => m.id !== modId)
    manifest.mods.push({
      id: modId,
      name: displayName,
      enabled: false,
      installDate: Date.now(),
      files: [],
      type,
      version,
      nexusId
    })
    this.writeManifest(gameId, manifest)

    if (autoEnable) {
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

    await this.runCommand(gameId, 'install', modStagingPath, this.gamePaths[gameId], modStagingPath)

    // Re-read manifest as registerInstalledFile updates it
    const updatedManifest = this.readManifest(gameId)
    const updatedMod = updatedManifest.mods.find((m) => m.id === modId)
    if (updatedMod) updatedMod.enabled = true
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
    // Filter enabled mods (excluding loaders? usually users want to disable mods but keep the loader?
    // Or just disable everything? "Disable All" usually implies everything.
    // Let's protect the loader if possible? No, usually you want to go vanilla.

    // We iterate deeply to ensure sequential disabling (file cleanup)
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

  async validateGame(gameId: string) {
    try {
      const result = await this.runCommand(gameId, 'checkRequirements', this.gamePaths[gameId])
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
      // Backward compatibility for boolean return (if we had kept it)
      if (result === false) return { valid: false, message: 'Requirements not met' }
      return { valid: true }
    } catch (e) {
      return { valid: true }
    }
  }

  // --- Base ---

  async runCommand(pluginId: string, command: string, ...args: any[]) {
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

    try {
      if (typeof plugin[command] === 'function') {
        const result = await plugin[command](...args)
        return result
      }
      return null
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
            // Force ID to be a native string to avoid Map keys being Proxies
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

  getPlugins() {
    return this.getGamesInternal()
  }

  getSupportedExtensions(gameId: string): string[] {
    const plugin = this.plugins.get(gameId)
    // Access property dynamically as it isn't in strictly typed interface yet
    const exts = (plugin as any)?.modFileExtensions
    if (exts && Array.isArray(exts)) {
      return exts
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
    const pluginDir = path.dirname(mainFile)
    const zip = new AdmZip()
    console.log(pluginDir)
    zip.addLocalFolder(pluginDir)
    return zip.toBuffer()
  }
}
