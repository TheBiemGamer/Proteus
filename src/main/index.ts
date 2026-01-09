import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import sudo from '@expo/sudo-prompt'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { PluginManager } from './pluginLoader'
import { SettingsManager } from './settings'
import { fetchNexusMetadata } from './utils/nexus'

const pluginManager = new PluginManager(is.dev ? process.cwd() : process.resourcesPath)
const settingsManager = new SettingsManager()

// Relay events
pluginManager.on('download-progress', (data) => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('download-progress', data)
  }
})

pluginManager.on('auto-repair-started', (data) => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('auto-repair-started', data)
  }
})

pluginManager.on('auto-repair-finished', (data) => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('auto-repair-finished', data)
  }
})

pluginManager.on('games-detected', (data) => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length > 0) {
    wins[0].webContents.send('games-detected', data)
  }
})

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 720,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

function isWindowsAdmin(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('net session', (err) => {
      resolve(!err)
    })
  })
}

async function checkAndPromptForAdmin(
  method: string,
  alwaysAdmin: boolean = false
): Promise<boolean> {
  // If not Windows, skip
  if (process.platform !== 'win32') return true

  // Check if we already have admin
  const isAdmin = await isWindowsAdmin()
  if (isAdmin) return true

  // Check suppression
  const settings = settingsManager.get()

  // Condition 1: Always Run As Admin is ON
  // Condition 2: Method is Symlink (which needs admin/dev mode)
  const needsPrivileges = alwaysAdmin || method === 'symlink'

  if (!needsPrivileges) return true

  // If user suppressed the warning and we are only here because of symlink (not explicit alwaysAdmin), skip
  if (!alwaysAdmin && settings.suppressAdminWarning) {
    return true
  }

  // If forced by "Always Run As Admin", we don't ask, we just restart (or warn in dev)
  if (alwaysAdmin) {
    if (is.dev) {
      // In dev, we can't silently restart easily without losing the terminal session
      // So we just warn once.
      console.log('App configured to Always Run as Admin, but in Dev mode.')
      return true
    }
    // Production: Restart immediately
    console.log('App configured to Always Run as Admin. Restarting with sudo-prompt...')
    const exe = app.getPath('exe')

    const args = process.argv
      .slice(1)
      .map((arg) => `"${arg.replace(/"/g, '\\"')}"`)
      .join(' ')

    const command = `cmd /c start "" "${exe}" ${args}`

    const options = {
      name: 'Proteus Mod Manager'
    }

    sudo.exec(command, options, (error) => {
      if (error) {
        console.error('Failed to restart as admin:', error)
      }
    })

    // Give sudo-prompt a moment to trigger the elevation process before killing self
    setTimeout(() => {
      app.exit(0)
    }, 100)

    return false
  }

  // If we are here, it's because of Symlink requirement (and alwaysAdmin is false)
  // We show the dialog recommendation.

  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    mainWindow.webContents.send('request-admin-permission')
  }
  return true
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  const settings = settingsManager.get()

  if (process.platform === 'win32' && settings.alwaysRunAsAdmin) {
    // UIPI Bypass: Write to signal file instead of escalating to avoid UAC prompt
    const file = process.argv.find((arg) =>
      ['.pmm-pack', '.modpack', '.pmm-ext', '.modmanager'].some((ext) =>
        arg.toLowerCase().endsWith(ext)
      )
    )

    if (file) {
      try {
        const signalPath = join(app.getPath('userData'), 'ipc-signal.json')
        fs.writeFileSync(signalPath, JSON.stringify({ filePath: file }))
      } catch (e) {
        console.error('Failed to signal main instance', e)
      }
    }
  }
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      const file = commandLine.find((arg) =>
        ['.pmm-pack', '.modpack', '.pmm-ext', '.modmanager'].some((ext) =>
          arg.toLowerCase().endsWith(ext)
        )
      )
      if (file) {
        mainWindow.webContents.send('open-file', file)
      }
    }
  })

  app
    .whenReady()
    .then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.biem.proteus')

    // Setup File Watcher for UIPI Bypass (User -> Admin signal)
    const signalPath = join(app.getPath('userData'), 'ipc-signal.json')
    if (!fs.existsSync(signalPath)) {
      try {
        fs.writeFileSync(signalPath, JSON.stringify({}))
      } catch (e) {
        console.error('Failed to init signal file', e)
      }
    }

    try {
      fs.watch(signalPath, (eventType) => {
        if (eventType === 'change') {
          try {
            // readFileSync can fail if file is locked or empty during write
            // Retry logic or simple ignore is usually okay for this IPC
            const content = fs.readFileSync(signalPath, 'utf-8')
            if (!content) return
            const data = JSON.parse(content)
            if (data.filePath) {
              const wins = BrowserWindow.getAllWindows()
              if (wins.length > 0) {
                const win = wins[0]
                if (win.isMinimized()) win.restore()
                win.focus()
                win.webContents.send('open-file', data.filePath)
                
                // Clear signal to prevent loops/re-reads
                fs.writeFileSync(signalPath, JSON.stringify({}))
              }
            }
          } catch (e) {
            // Ignore read/parse errors (e.g. file busy)
          }
        }
      })
    } catch (e) {
      console.error('Failed to setup file watcher', e)
    }

    // Sync Initial Settings
    const settings = settingsManager.get()
    pluginManager.setNexusApiKey(settings.nexusApiKey)
    pluginManager.setDeploymentMethod(settings.deploymentMethod)

    // Initial game detection
    pluginManager.autoDetectGames()

    // listen for list extentions
    ipcMain.handle('get-extensions', async () => {
      return await pluginManager.getGamesWithDetails()
    })

    ipcMain.handle('fetch-nexus-metadata', async (_, nexusApiKey, gameDomain, nexusId) => {
      return fetchNexusMetadata(nexusApiKey, gameDomain, nexusId)
    })

    ipcMain.handle('get-app-version', () => {
      return app.getVersion()
    })

    // run commands
    ipcMain.handle('run-extension-command', async (_event, gameId, command, ...args) => {
      try {
        return await pluginManager.runCommand(gameId, command, ...args)
      } catch (e: any) {
        console.error('Plugin Execution Failed:', e)
        throw e
      }
    })

    ipcMain.handle('manage-game', async (_, gameId) => {
      return await pluginManager.manageGame(gameId)
    })
    ipcMain.handle('unmanage-game', async (_, gameId) => {
      return await pluginManager.unmanageGame(gameId)
    })
    ipcMain.handle('analyze-file', async (_, gameId, filePath) => {
      return await pluginManager.analyzeFile(gameId, filePath)
    })

    ipcMain.handle('install-mod-dialog', async (_, gameId) => {
      const extensions = pluginManager.getSupportedExtensions(gameId)
      console.log(`Opening mod dialog for ${gameId} with extensions:`, extensions)
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Supported Mod Files', extensions }]
      })

      if (canceled || filePaths.length === 0) return { canceled: true }

      // Returning just the first one? The logic in App.tsx seems to handle one currently,
      // but the request was about the dialog filter.
      // If the valid formats are strictly adhered to, only valid files will be picked.

      return { canceled: false, filePath: filePaths[0], filePaths }
    })

    ipcMain.handle('install-mod-direct', async (_, gameId, filePath, options) => {
      try {
        await pluginManager.installMod(gameId, filePath, options)
        return true
      } catch (err) {
        console.error(err)
        return false
      }
    })

    ipcMain.handle('get-mods', async (_, gameId) => {
      return await pluginManager.getMods(gameId)
    })

    ipcMain.handle('check-mod-update', async (_, gameId, modId) => {
      return await pluginManager.checkModUpdate(gameId, modId)
    })

    ipcMain.handle('validate-game', async (_, gameId) => {
      return await pluginManager.validateGame(gameId)
    })

    ipcMain.handle('open-url', async (_, url) => {
      await shell.openExternal(url)
    })

    // Settings IPC
    ipcMain.handle('get-settings', () => settingsManager.get())
    ipcMain.handle('save-settings', async (_, settings) => {
      const s = settingsManager.set(settings)
      pluginManager.setNexusApiKey(s.nexusApiKey)
      pluginManager.setDeploymentMethod(s.deploymentMethod)
      // Only check if we activated "Always Run" or switched to Symlink.
      // However, if we just switched to Symlink, the renderer will likely trigger the modal flow separately anyway?
      // Actually, calling checkAndPromptForAdmin here is correct, it will emit the event if needed.
      await checkAndPromptForAdmin(s.deploymentMethod, s.alwaysRunAsAdmin)
      return s
    })

    ipcMain.handle('restart-as-admin', () => {
      if (is.dev) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Developer Mode Detected',
          message: 'Restarting as Admin is not automatically supported in Dev environment.',
          detail:
            'Please stop the process and run "gsudo pnpm dev" or run your terminal as Administrator.'
        })
        return
      }
      const exe = app.getPath('exe')

      const args = process.argv
        .slice(1)
        .map((arg) => `"${arg.replace(/"/g, '\\"')}"`)
        .join(' ')

      const command = `cmd /c start "" "${exe}" ${args}`

      const options = {
        name: 'Proteus Mod Manager'
      }

      console.log(`[Admin Restart IPC] Executing via sudo-prompt`)

      sudo.exec(command, options, (error) => {
        if (error) {
          console.error('Failed to restart as admin:', error)
        }
      })

      setTimeout(() => {
        app.exit(0)
      }, 100)
    })

    ipcMain.handle('toggle-mod', async (_, gameId, modId, enabled) => {
      try {
        if (enabled) {
          return await pluginManager.enableMod(gameId, modId)
        } else {
          return await pluginManager.disableMod(gameId, modId)
        }
      } catch (e: any) {
        console.error(e)
        throw e // Propagate error to renderer
      }
    })

    ipcMain.handle('delete-mod', async (_, gameId, modId) => {
      try {
        return await pluginManager.deleteMod(gameId, modId)
      } catch (e) {
        console.error(e)
        return false
      }
    })

    ipcMain.handle('enable-all-mods', async (_, gameId) => {
      try {
        return await pluginManager.enableAllMods(gameId)
      } catch (e) {
        console.error(e)
        return false
      }
    })

    ipcMain.handle('disable-all-mods', async (_, gameId) => {
      try {
        return await pluginManager.disableAllMods(gameId)
      } catch (e) {
        console.error(e)
        return false
      }
    })

    ipcMain.handle('get-extension-list', async () => {
      return await pluginManager.getExtensionList()
    })

    ipcMain.handle('toggle-extension', async (_, id, enabled) => {
      return await pluginManager.toggleExtension(id, enabled)
    })

    ipcMain.handle('add-game', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Executable', extensions: ['exe'] }]
      })

      if (canceled || filePaths.length === 0) return { canceled: true }

      const filePath = filePaths[0]
      const gameName = path.basename(filePath, '.exe')
      const gameId = gameName.toLowerCase().replace(/\s/g, '')

      return await pluginManager.addGame(gameId, gameName, filePath)
    })

    ipcMain.handle('delete-extension', async (_, id) => {
      return await pluginManager.deleteExtension(id)
    })

    // install-extension-dialog: Now returns content preview if possible
    ipcMain.handle('install-extension-dialog', async (_) => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Mod Manager Extensions', extensions: ['pmm-ext', 'modmanager', 'zip'] }]
      })

      if (canceled || filePaths.length === 0) return { canceled: true }

      // If it's a modmanager file (or zip we treat as package), preview it
      // For simple js files (if we support that), install direct.
      // But keeping it consistent: return preview.
      try {
        // We need a method to peek inside the zip without installing
        const preview = await pluginManager.previewExtensionPackage(filePaths[0])
        return { canceled: false, filePath: filePaths[0], preview }
      } catch (err: any) {
        console.error('Extension preview failed', err)
        return { canceled: true, error: err.message }
      }
    })

    ipcMain.handle('install-extensions-confirm', async (_, filePath, selectedFiles) => {
      try {
        return await pluginManager.installSelectedExtensions(filePath, selectedFiles)
      } catch (e) {
        console.error(e)
        return false
      }
    })

    ipcMain.handle('get-plugin-metadata', async (_, filePath) => {
      return await pluginManager.getPluginMetadata(filePath)
    })

    ipcMain.handle('install-plugin-direct', async (_, filePath) => {
      try {
        return await pluginManager.installExtension(filePath)
      } catch (e) {
        console.error(e)
        return false
      }
    })

    ipcMain.handle('export-extensions', async (_, extensionIds) => {
      try {
        // Create a zip containing all selected extensions

        // Better approach: Let pluginManager handle the bulk export
        const buffer = await pluginManager.exportExtensionsBulk(extensionIds)
        if (!buffer) return false

        const { canceled, filePath } = await dialog.showSaveDialog({
          defaultPath: `modmanager-bundle.pmm-ext`,
          filters: [{ name: 'Mod Manager Extension Bundle', extensions: ['pmm-ext', 'modmanager'] }]
        })

        if (canceled || !filePath) return false

        await require('fs').promises.writeFile(filePath, buffer)
        return true
      } catch (err) {
        console.error('Extension export failed', err)
        return false
      }
    })

    ipcMain.handle('export-extension', async (_, gameId) => {
      try {
        const buffer = await pluginManager.exportExtension(gameId)
        if (!buffer) return false

        // Ask user where to save
        const { canceled, filePath } = await dialog.showSaveDialog({
          defaultPath: `${gameId}.pmm-ext`,
          filters: [{ name: 'Mod Manager Extension', extensions: ['pmm-ext', 'modmanager'] }]
        })

        if (canceled || !filePath) return false

        await require('fs').promises.writeFile(filePath, buffer)
        return true
      } catch (err) {
        console.error('Extension export failed', err)
        return false
      }
    })

    // --- Modpack IPC ---

    ipcMain.handle('get-modpack-metadata', async (_, filePath) => {
      try {
        return await pluginManager.getModpackMetadata(filePath)
      } catch (e) {
        console.error(e)
        throw e
      }
    })

    ipcMain.handle('get-username', async () => {
      const os = require('os')
      return os.userInfo().username
    })

    ipcMain.handle('browse-image', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }
        ]
      })

      if (canceled || filePaths.length === 0) return { canceled: true }
      return { canceled: false, filePath: filePaths[0] }
    })

    ipcMain.handle('download-image', async (_, url) => {
      try {
        const axios = require('axios')
        const response = await axios.get(url, { responseType: 'arraybuffer' })
        
        const tempDir = path.join(app.getPath('userData'), 'Temp')
        if (!require('fs').existsSync(tempDir)) {
          require('fs').mkdirSync(tempDir, { recursive: true })
        }

        const ext = path.extname(new URL(url).pathname) || '.png'
        const fileName = `modpack-image-${Date.now()}${ext}`
        const filePath = path.join(tempDir, fileName)
        
        require('fs').writeFileSync(filePath, Buffer.from(response.data))
        
        return { success: true, filePath }
      } catch (e: any) {
        console.error('Failed to download image:', e)
        return { success: false, error: e.message }
      }
    })

    ipcMain.handle('create-modpack-dialog', async (_, gameId, meta) => {
      // meta includes title, author, version, description, imagePath (optional), selectedModIds (optional)
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${(meta.title || 'modpack').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pmm-pack`,
        filters: [{ name: 'Modpack', extensions: ['pmm-pack', 'modpack'] }]
      })

      if (canceled || !filePath) return false

      try {
        return await pluginManager.createModpack(gameId, meta, filePath)
      } catch (e) {
        console.error(e)
        return false
      }
    })

    ipcMain.handle('pick-modpack', async (_) => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Modpack', extensions: ['pmm-pack', 'modpack'] }]
      })
      if (canceled || filePaths.length === 0) return null

      const filePath = filePaths[0]
      try {
        const info = await pluginManager.getModpackMetadata(filePath)
        return { ...info, filePath }
      } catch (e) {
        console.error(e)
        throw e
      }
    })

    ipcMain.handle('install-modpack', async (_, filePath) => {
      try {
        return await pluginManager.installModpack(filePath)
      } catch (e) {
        console.error(e)
        throw e
      }
    })

    // Auto Updater
    ipcMain.handle('check-for-updates', async () => {
      if (process.argv.includes('--no-update')) {
        console.log('Update check skipped by --no-update flag')
        return null
      }

      if (!is.dev) {
        console.log('Checking for updates...')
        try {
          // Timeout after 15 seconds to prevent UI hanging on custom builds
          const result = await Promise.race([
            autoUpdater.checkForUpdates(),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('Update check timed out')), 15000)
            )
          ])
          return result
        } catch (error: any) {
          console.warn('Update check warning:', error.message)
          return null
        }
      } else {
        console.log('Skipping update check in dev mode')
      }
      return null
    })

    ipcMain.handle('quit-and-install', () => {
      autoUpdater.quitAndInstall()
    })

    autoUpdater.on('update-available', () => {
      console.log('Update available')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) mainWindow.webContents.send('update-available')
    })

    autoUpdater.on('update-not-available', () => {
      console.log('Update not available')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) mainWindow.webContents.send('update-not-available')
    })

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err)
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) mainWindow.webContents.send('update-error', err.message)
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('Update downloaded')
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) mainWindow.webContents.send('update-downloaded')
    })

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const mainWindow = createWindow()
    mainWindow.once('ready-to-show', async () => {
      try {
        const file = process.argv.find((arg) =>
          ['.pmm-pack', '.modpack', '.pmm-ext', '.modmanager'].some((ext) =>
            arg.toLowerCase().endsWith(ext)
          )
        )
        if (file) {
          setTimeout(() => {
            mainWindow.webContents.send('open-file', file)
          }, 500)
        }

        if (!settings.tutorialCompleted) {
          // If tutorial is not completed, skip admin checks and updates
          // and go straight to showing the window.
          mainWindow.show()
          return
        }

        const shouldContinue = await checkAndPromptForAdmin(
          settings.deploymentMethod,
          settings.alwaysRunAsAdmin
        )

        if (!shouldContinue) return

        // Only show window if we are continuing execution
        mainWindow.show()

        if (process.argv.includes('--no-update')) {
          console.log('Update check skipped by --no-update flag')
          return
        }

        if (!is.dev) {
          console.log('Validating update configuration...')
          autoUpdater.checkForUpdatesAndNotify().catch((e) => {
            console.error('Failed to check for updates on startup:', e)
          })
        }
      } catch (err) {
        console.error('Error in ready-to-show handler:', err)
        // If error occurs, ensure window is shown so user sees something (or the error dialog)
        mainWindow.show()
      }
    })

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((err) => {
    console.error('Fatal startup error:', err)
    dialog.showErrorBox('Fatal Startup Error', err.stack || err.message || String(err))
    app.quit()
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
