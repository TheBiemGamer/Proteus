import axios from 'axios'

export async function fetchNexusMetadata(
  nexusApiKey: string | null,
  gameSlug: string,
  nexusId: string
) {
  if (!nexusApiKey) return null
  try {
    const url = `https://api.nexusmods.com/v1/games/${gameSlug}/mods/${nexusId}.json`
    const headers = {
      apikey: nexusApiKey,
      'Application-Name': 'ModManager',
      'Application-Version': '1.0.0'
    }
    const response = await axios.get(url, { headers })
    return response.data
  } catch (e: any) {
    console.warn(`Nexus fetch failed for ${nexusId}: ${e.message}`)
    return null
  }
}

export async function checkNexusUpdate(
  nexusApiKey: string | null,
  gameSlug: string,
  nexusId: string,
  currentVersion?: string
) {
  if (!nexusApiKey) return { error: 'Nexus API Key not set in Settings' }

  try {
    const url = `https://api.nexusmods.com/v1/games/${gameSlug}/mods/${nexusId}.json`
    const headers = {
      apikey: nexusApiKey,
      'Application-Name': 'ModManager',
      'Application-Version': '1.0.0'
    }

    const response = await axios.get(url, { headers })
    const data = response.data

    const latestVersion = data.version
    const updateAvailable = latestVersion !== currentVersion

    return {
      supported: true,
      updateAvailable,
      latestVersion,
      downloadUrl: `https://www.nexusmods.com/${gameSlug}/mods/${nexusId}?tab=files`
    }
  } catch (e: any) {
    return { error: e.response?.data?.message || e.message }
  }
}
