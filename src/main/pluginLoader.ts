import fs from 'fs'
import path from 'path'
import { NodeVM } from 'vm2'
import { IGameExtension } from '../shared/types'

export class PluginManager {
  private plugins: Map<string, IGameExtension> = new Map()
  private pluginsDir: string

  private activeGamePath: string | null = null

  constructor(appPath: string) {
    // looks for 'plugins' folder next to executable
    this.pluginsDir = path.join(appPath, 'plugins')
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir)
    }
  }

  // helper to check if path is in game folder
  private isSafePath(targetPath: string): boolean {
    if (!this.activeGamePath) return false

    const resolvedTarget = path.resolve(targetPath)
    const resolvedSafe = path.resolve(this.activeGamePath)

    return resolvedTarget.startsWith(resolvedSafe)
  }

  // plugin sandbox
  private createSandbox() {
    return {
      console: { log: (msg) => console.log(`[PLUGIN]: ${msg}`) },
      manager: {
        // safe file manager
        fileExists: (filePath) => fs.existsSync(filePath),
        isDirectory: (filePath) => {
          try {
            return fs.lstatSync(filePath).isDirectory()
          } catch {
            return false
          }
        },
        readDir: (dirPath) => {
          try {
            return fs.readdirSync(dirPath)
          } catch {
            return []
          }
        },
        copyFile: (src, dest) => {
          if (!this.isSafePath(dest)) {
            console.error(`BLOCKED: Plugin tried to write outside game folder: ${dest}`)
            throw new Error('Access Denied: You can only write inside the game folder.')
          }

          console.log(`[HOST] Copying ${src} -> ${dest}`)

          const destDir = path.dirname(dest)
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true })
          }
          fs.copyFileSync(src, dest)
        },
        writeConfig: (filePath, content) => {
          if (!this.isSafePath(filePath)) {
            console.error(`BLOCKED: Plugin tried to write outside game folder: ${filePath}`)
            throw new Error('Access Denied: You can only write inside the game folder.')
          }
          console.log('Writing config')
          // this should be changed to be restricted to inside game folder
          fs.writeFileSync(filePath, content)
        }
      }
    }
  }

  // run commands safe
  async runCommand(pluginId: string, command: string, ...args: any[]) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`)
    if (typeof plugin[command] !== 'function') throw new Error(`Command ${command} not found`)

    let gamePath: string | null = null

    if (command === 'deployMod' && args.length >= 2) {
      gamePath = args[1]
    }

    this.activeGamePath = gamePath

    try {
      console.log(`[EXEC] Running ${command} on ${pluginId} (Safe Scope: ${gamePath || 'None'})`)
      return await plugin[command](...args)
    } finally {
      this.activeGamePath = null
    }
  }

  loadPlugins() {
    console.log(`Scanning for plugins in: ${this.pluginsDir}`)
    const files = fs.readdirSync(this.pluginsDir)

    files.forEach((file) => {
      if (file.endsWith('.js')) {
        try {
          const fullPath = path.join(this.pluginsDir, file)
          const code = fs.readFileSync(fullPath, 'utf8')

          const vm = new NodeVM({
            console: 'redirect',
            sandbox: this.createSandbox(),
            require: {
              external: true, // potentially unsafe
              builtin: ['path']
            }
          })

          try {
            const pluginExports = vm.run(code, fullPath)

            const plugin = pluginExports.default || pluginExports

            if (plugin && plugin.id) {
              this.plugins.set(plugin.id, plugin)
              console.log(`Plugin loaded: ${plugin.name}`)
            }
          } catch (err) {
            console.error(`Sandbox error in ${file}:`, err)
          }
        } catch (err) {
          console.error(`Failed to load plugin ${file}:`, err)
        }
      }
    })
  }

  getPlugins() {
    return Array.from(
      this.plugins.values().map((p) => ({
        id: p.id,
        name: p.name,
        author: p.author,
        executable: p.executable,
        version: p.version
      }))
    )
  }
}
