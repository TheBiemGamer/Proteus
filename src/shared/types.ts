export interface IGameExtension {
  id: string
  name: string
  executable: string
  steamAppId?: string // Optional Steam App ID
  detect: (candidates: string[]) => Promise<string | null>
  install: (sourcePath: string, gamePath: string, originalZipPath: string) => Promise<boolean>
  toggleLoader?: (enable: boolean) => Promise<boolean>
}

export interface IMod {
  id: string
  name: string
  enabled: boolean
  installDate: number
  files: string[] // List of absolute paths installed
  type: 'mod' | 'loader' | string
  version?: string
  nexusId?: string
}
