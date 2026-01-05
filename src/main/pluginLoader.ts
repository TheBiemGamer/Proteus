import fs from 'fs'
import path from 'path'
import { NodeVM, VMScript } from 'vm2'
import { IGameExtension } from '../shared/types'

export class PluginManager {
  private plugins: Map<string, IGameExtension> = new Map()
  private pluginsDir: string

  constructor(appPath: string) {
    // looks for 'plugins' folder next to executable
    this.pluginsDir = path.join(appPath, 'plugins')
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir)
    }
  }

  // plugin sandbox
  private createSandbox() {
    return {
      console: { log: (msg) => console.log(`[PLUGIN]: ${msg}`) },
      manager: {
        // safe file manager
        fileExists: (filePath) => fs.existsSync(filePath),
        writeConfig: (filePath, content) => {
          console.log('Writing config')
          // this should be changed to be restricted to inside game folder
          fs.writeFileSync(filePath, content)
        }
      }
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
