import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { IAppSettings } from '../shared/types'

export class SettingsManager {
  private settingsPath: string
  private settings: IAppSettings

  private defaultSettings: IAppSettings = {
    language: 'en',
    nexusApiKey: '',
    developerMode: false,
    startMaximized: false
  }

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
    this.settings = this.load()
  }

  private load(): IAppSettings {
    if (!fs.existsSync(this.settingsPath)) {
      this.save(this.defaultSettings)
      return { ...this.defaultSettings }
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'))
      return { ...this.defaultSettings, ...data }
    } catch {
      return { ...this.defaultSettings }
    }
  }

  private save(settings: IAppSettings) {
    fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2))
  }

  get(): IAppSettings {
    return this.settings
  }

  set(newSettings: Partial<IAppSettings>) {
    this.settings = { ...this.settings, ...newSettings }
    this.save(this.settings)
    return this.settings
  }
}
