import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import sevenBin from '7zip-bin'
import Seven from 'node-7z'

function get7zBinary(): string {
  const isWin = process.platform === 'win32'
  if (isWin) {
    const possiblePaths = [
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7z.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe')
    ]
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p
    }
  }
  return sevenBin.path7za
}

export async function listArchiveFiles(src: string): Promise<string[]> {
  const ext = path.extname(src).toLowerCase()

  if (!['.zip', '.rar', '.7z', '.mod'].includes(ext)) {
    return [path.basename(src)]
  }

  if (ext === '.zip' || ext === '.mod') {
    try {
      const zip = new AdmZip(src)
      return zip.getEntries().map((e) => e.entryName)
    } catch (e) {
      console.warn('AdmZip failed listing, trying 7zip fallback', e)
    }
  }

  const bin = get7zBinary()
  return new Promise((resolve, reject) => {
    const files: string[] = []
    const stream = Seven.list(src, {
      $bin: bin,
      $r: true
    })
    stream.on('data', (d: any) => {
      if (d.file) files.push(d.file)
    })
    stream.on('end', () => resolve(files))
    stream.on('error', (err: any) => {
      reject(err)
    })
  })
}

export async function extractArchive(src: string, dest: string): Promise<void> {
  const ext = path.extname(src).toLowerCase()

  if (!['.zip', '.rar', '.7z', '.mod'].includes(ext)) {
    const fileName = path.basename(src)
    fs.copyFileSync(src, path.join(dest, fileName))
    return
  }

  if (ext === '.zip' || ext === '.mod') {
    try {
      const zip = new AdmZip(src)
      zip.extractAllTo(dest, true)
      return
    } catch (e) {
      console.warn('AdmZip failed, trying 7zip fallback', e)
    }
  }

  const bin = get7zBinary()

  if (ext === '.rar' && bin.endsWith('7za.exe')) {
    console.warn('Attempting to extract RAR with 7za.exe. This usually fails. Install 7-Zip.')
  }

  return new Promise((resolve, reject) => {
    const stream = Seven.extractFull(src, dest, {
      $bin: bin
    })
    stream.on('end', () => resolve())
    stream.on('error', (err: any) => {
      if (ext === '.rar' && bin.endsWith('7za.exe')) {
        reject(
          new Error(
            'Failed to extract .rar file. Please install 7-Zip (64-bit) in the default location to support RAR archives.'
          )
        )
      } else {
        if (err.stderr) console.error('7z Stderr:', err.stderr)
        reject(err)
      }
    })
  })
}
