import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { IModpackManifest } from '../../shared/types'
import { app } from 'electron'

// Interface for what ModpackManager needs from the main PluginManager
interface IPluginManagerContext {
  readManifest: (gameId: string) => any
  writeManifest: (gameId: string, data: any) => void
  stagingDir: string
  gamePaths: Record<string, string>
  runCommand: (gameId: string, command: string, ...args: any[]) => Promise<any>
  enableMod: (gameId: string, modId: string) => Promise<boolean>
  installMod: (gameId: string, filePath: string, options: any) => Promise<boolean>
  _fetchNexusMetadata: (gameId: string, nexusId: string) => Promise<any>
}

export class ModpackManager {
  private context: IPluginManagerContext

  constructor(context: IPluginManagerContext) {
    this.context = context
  }

  async createModpack(gameId: string, meta: any, destPath: string) {
    const manifest = this.context.readManifest(gameId)
    const enabledMods = manifest.mods.filter((m: any) => {
      if (!m.enabled) return false
      const type = m.type.toLowerCase()
      return type !== 'loader' && type !== 'binaries'
    })

    const zip = new AdmZip()

    const packManifest: IModpackManifest = {
      meta: {
        title: meta.title,
        description: meta.description,
        author: meta.author,
        version: meta.version,
        gameId: gameId
      },
      mods: []
    }

    for (const mod of enabledMods) {
      packManifest.mods.push({
        id: mod.id,
        name: mod.name,
        nexusId: mod.nexusId,
        version: mod.version
      })

      const modStagingPath = path.join(this.context.stagingDir, gameId, mod.id)
      if (fs.existsSync(modStagingPath)) {
        zip.addLocalFolder(modStagingPath, `mods/${mod.id}`)
      }
    }

    if (meta.imagePath && fs.existsSync(meta.imagePath)) {
      zip.addLocalFile(meta.imagePath, '', 'icon.png')
    }

    zip.addFile('modpack.json', Buffer.from(JSON.stringify(packManifest, null, 2)))

    zip.writeZip(destPath)
    return true
  }

  async getModpackMetadata(modpackPath: string) {
    try {
      const zip = new AdmZip(modpackPath)
      const entry = zip.getEntry('modpack.json')
      if (!entry) throw new Error('Invalid Modpack')

      const content = zip.readAsText(entry)
      const manifest: IModpackManifest = JSON.parse(content)

      let image: string | undefined
      const validExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.gif']
      const iconEntry = zip.getEntries().find((e) => {
        const ext = path.extname(e.entryName).toLowerCase()
        return e.entryName.startsWith('icon.') && validExtensions.includes(ext)
      })

      if (iconEntry) {
        const buf = zip.readFile(iconEntry)
        if (buf) {
          const ext = path.extname(iconEntry.entryName).substring(1)
          image = `data:image/${ext};base64,${buf.toString('base64')}`
        }
      }

      return { ...manifest, image }
    } catch (e) {
      throw new Error('Failed to read modpack: ' + e)
    }
  }

  async installModpack(modpackPath: string) {
    const zip = new AdmZip(modpackPath)
    const entry = zip.getEntry('modpack.json')
    if (!entry) throw new Error('Invalid Modpack')
    const packManifest: IModpackManifest = JSON.parse(zip.readAsText(entry))

    const gameId = packManifest.meta.gameId

    if (!this.context.gamePaths[gameId]) {
      throw new Error(`Game ${gameId} not managed or detected.`)
    }

    const tempDir = path.join(app.getPath('userData'), 'Temp', 'ModpackInstall')
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
    fs.mkdirSync(tempDir, { recursive: true })

    zip.extractAllTo(tempDir, true)

    const modsDir = path.join(tempDir, 'mods')
    if (fs.existsSync(modsDir)) {
      const modDirs = fs.readdirSync(modsDir)
      for (const modId of modDirs) {
        const source = path.join(modsDir, modId)
        const dest = path.join(this.context.stagingDir, gameId, modId)

        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true })
        if (!fs.existsSync(path.dirname(dest)))
          fs.mkdirSync(path.dirname(dest), { recursive: true })

        fs.cpSync(source, dest, { recursive: true })

        const modMeta = packManifest.mods.find((m) => m.id === modId) || { id: modId, name: modId }

        let type = 'mod'
        const customType = await this.context.runCommand(gameId, 'determineModType', dest)
        if (customType && typeof customType === 'string') {
          type = customType
        } else if (
          fs.existsSync(path.join(dest, 'dinput8.dll')) ||
          modId.toLowerCase().includes('loader')
        ) {
          type = 'loader'
        }

        let author: string | undefined
        let description: string | undefined
        let imageUrl: string | undefined
        let version = modMeta.version

        if (modMeta.nexusId) {
          const data = await this.context._fetchNexusMetadata(gameId, modMeta.nexusId)
          if (data) {
            if (data.uploaded_by) author = data.uploaded_by
            if (data.summary) description = data.summary
            if (data.picture_url) imageUrl = data.picture_url
            if (data.version && !version) version = data.version
          }
        }

        const gameManifest = this.context.readManifest(gameId)
        let existing = gameManifest.mods.find((m: any) => m.id === modId)
        if (!existing) {
          existing = {
            id: modId,
            name: modMeta.name,
            enabled: false,
            installDate: Date.now(),
            files: [],
            type,
            version,
            nexusId: modMeta.nexusId,
            author,
            description,
            imageUrl
          }
          gameManifest.mods.push(existing)
          this.context.writeManifest(gameId, gameManifest)
        } else {
          if (modMeta.nexusId && !existing.nexusId) existing.nexusId = modMeta.nexusId
          if (author && !existing.author) existing.author = author
          if (description && !existing.description) existing.description = description
          if (imageUrl && !existing.imageUrl) existing.imageUrl = imageUrl
          if (type !== 'mod' && existing.type === 'mod') existing.type = type
          this.context.writeManifest(gameId, gameManifest)
        }

        await this.context.enableMod(gameId, modId)
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
    return gameId
  }
}
