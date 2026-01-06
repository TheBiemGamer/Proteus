export interface IGameExtension {
  id: string
  name: string
  executable: string
  steamAppId?: string
  iconUrl?: string
  modSources?: Array<{ text: string; url: string }>
  detect: (candidates: string[]) => Promise<string | null>
  install: (
    sourcePath: string,
    gamePath: string,
    originalZipPath: string
  ) => Promise<boolean | { success: boolean; note?: string }>
  toggleLoader?: (enable: boolean) => Promise<boolean>
}

export interface IMod {
  id: string
  name: string
  enabled: boolean
  installDate: number
  files: string[]
  type: 'mod' | 'loader' | string
  version?: string
  nexusId?: string
  sourceUrl?: string
  author?: string
  description?: string
  imageUrl?: string
  note?: string
  nexusDomain?: string
}

export interface IModpackMeta {
  title: string
  author: string
  version: string
  description: string
  gameId: string
}

export interface IModpackManifest {
  meta: IModpackMeta
  mods: Array<{
    id: string
    name: string
    nexusId?: string
    version?: string
  }>
}

export interface IAppSettings {
  language: 'en' | 'nl'
  nexusApiKey?: string
  developerMode: boolean
  startMaximized: boolean
}
