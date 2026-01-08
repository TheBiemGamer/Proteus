const fs = require('fs')
const cp = require('child_process')
const pack = JSON.parse(fs.readFileSync('package.json', 'utf8'))

console.log('\x1b[36mProteus Mod Manager\x1b[0m')
console.log('-------------------')
console.log('Version: \x1b[33m' + pack.version + '\x1b[0m')

try {
  const branch = cp.execSync('git branch --show-current', { encoding: 'utf8' }).trim()
  console.log('Branch:  \x1b[32m' + branch + '\x1b[0m')

  const status = cp.execSync('git status --porcelain', { encoding: 'utf8' })
  if (!status) {
    console.log('Status:  \x1b[32mWorking tree clean\x1b[0m')
  } else {
    const lines = status.split('\n').filter((l) => l)
    const modified = lines.filter((l) => l.match(/^ M|^M |^MM/)).length
    const added = lines.filter((l) => l.match(/^ A|^A |^AM/)).length
    const deleted = lines.filter((l) => l.match(/^ D|^D /)).length
    const untracked = lines.filter((l) => l.startsWith('??')).length

    const parts = []
    if (modified) parts.push('\x1b[33m' + modified + ' modified\x1b[0m')
    if (added) parts.push('\x1b[32m' + added + ' added\x1b[0m')
    if (deleted) parts.push('\x1b[31m' + deleted + ' deleted\x1b[0m')
    if (untracked) parts.push('\x1b[90m' + untracked + ' untracked\x1b[0m')

    console.log('Changes: ' + parts.join(', '))
  }
} catch (e) {
  console.log('Git info unavailable')
}
console.log('-------------------')
