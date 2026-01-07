const remainder = "Tobey's BepInEx Pack for Subnautica-1108-5-4-23-pack-3-0-0"

const greedyRegex = /^(.*)-(\d+)-(.+)$/
let match = remainder.match(greedyRegex)

if (match) {
  let potentialName = match[1]
  let potentialId = match[2]
  let potentialVer = match[3]

  console.log('Initial Match:', { potentialName, potentialId, potentialVer })

  // Keep track of the best candidate (left-most valid nexus ID found so far)
  let bestName = potentialName
  let bestId = potentialId
  let bestVer = potentialVer

  // Scan leftwards to find better ID candidates (consuming version parts)
  // Increased depth and allow alphanumeric words to be consumed into version
  for (let i = 0; i < 20; i++) {
    console.log(`--- Loop ${i} ---`)
    console.log(`Current Name: "${potentialName}"`)

    const suffixMatch = potentialName.match(/-(\d+)$/)
    if (suffixMatch) {
      console.log('Suffix Match (Number):', suffixMatch[1])
      // Found a number to the left - new Candidate ID
      if (potentialId) {
        potentialVer = `${potentialId}-${potentialVer}`
      }
      potentialId = suffixMatch[1]
      potentialName = potentialName.substring(0, potentialName.length - suffixMatch[0].length)

      bestName = potentialName
      bestId = potentialId
      bestVer = potentialVer
      console.log(`Updated Best ID: ${bestId}`)
      continue
    }

    // Check for non-numeric version parts (e.g. "pack", "v", "beta")
    // We consume them into version but do not treat them as ID.
    const wordMatch = potentialName.match(/-([a-zA-Z0-9_\.]+)$/)
    if (wordMatch) {
      console.log('Word Match:', wordMatch[1])
      const part = wordMatch[1]
      if (potentialId) {
        potentialVer = `${potentialId}-${potentialVer}`
      }
      potentialVer = `${part}-${potentialVer}`
      potentialId = '' // Current "ID" slot is empty as we search left for a number
      potentialName = potentialName.substring(0, potentialName.length - wordMatch[0].length)
      continue
    }

    console.log('No match, breaking')
    break
  }

  console.log('Final Result:', { display: bestName, id: bestId, version: bestVer })
} else {
  console.log('No greedy match')
}
