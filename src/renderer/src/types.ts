export interface Game {
  id: string
  name: string
  detected: boolean
  managed: boolean
  path: string
  steamAppId?: string
  iconUrl?: string
  toolButtons?: Array<{ label: string; action: string }>
  modSources?: Array<{ text: string; url: string }>
  theme?: {
    accent: string
    bgStart: string
    bgEnd?: string
  }
}

export interface Mod {
  id: string
  name: string
  enabled: boolean
  type: string
  version?: string
  nexusId?: string
  sourceUrl?: string
  author?: string
  description?: string
  imageUrl?: string
  note?: string
  nexusDomain?: string
  error?: string
  updateAvailable?: boolean
  latestVersion?: string
  updateError?: string
}
