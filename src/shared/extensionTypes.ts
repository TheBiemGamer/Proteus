export interface IExtensionInfo {
  id: string // Filename without extension or directory name
  name: string // Display name from plugin
  path: string // Absolute path to main file
  isDirectory: boolean
  enabled: boolean
  version?: string
  author?: string
}
