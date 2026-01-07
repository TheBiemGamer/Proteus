import axios from 'axios'
import fs from 'fs'
import crypto from 'crypto'

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

async function calculateFileMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)
    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function validateModByHash(
  nexusApiKey: string | null,
  gameSlug: string,
  filePath: string
) {
  if (!nexusApiKey) return null

  try {
    const md5 = await calculateFileMD5(filePath)
    const url = `https://api.nexusmods.com/v1/games/${gameSlug}/mods/md5_search/${md5}.json`
    console.log(`[NexusAPI] MD5 Search: URL=${url} Hash=${md5}`)
    const headers = {
      apikey: nexusApiKey,
      'Application-Name': 'ModManager',
      'Application-Version': '1.0.0'
    }

    const response = await axios.get(url, { headers })
    console.log(`[NexusAPI] MD5 Response: ${JSON.stringify(response.data)}`)
    const results = response.data

    if (Array.isArray(results) && results.length > 0) {
      if (results.length > 1) {
        return results // Return all possible matches for logic layer to decide
      }
      return results[0]
    }
    return null
  } catch (e: any) {
    if (e.response && e.response.status === 404) {
      console.log(`[NexusAPI] MD5 404 - Not Found`)
      return null
    }
    console.warn(`Nexus MD5 check failed: ${e.message}`)
    return null
  }
}
