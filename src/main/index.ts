import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PluginManager } from './pluginLoader'
import { SettingsManager } from './settings'

const pluginManager = new PluginManager(process.cwd())
const settingsManager = new SettingsManager()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.biem.modmanager')

  // load plugins
  pluginManager.loadPlugins()
  pluginManager.autoDetectGames()

  // listen for list extentions
  ipcMain.handle('get-extensions', () => {
    return pluginManager.getPlugins()
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
  ipcMain.handle('install-mod-dialog', async (_, gameId) => {
    const extensions = pluginManager.getSupportedExtensions(gameId)
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Mods', extensions }]
    })

    if (canceled || filePaths.length === 0) return false

    try {
      await pluginManager.installMod(gameId, filePaths[0])
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  })

  ipcMain.handle('get-mods', async (_, gameId) => {
    return await pluginManager.getMods(gameId)
  })

  ipcMain.handle('validate-game', async (_, gameId) => {
    return await pluginManager.validateGame(gameId)
  })

  ipcMain.handle('open-url', async (_, url) => {
    await shell.openExternal(url)
  })

  // Settings IPC
  ipcMain.handle('get-settings', () => settingsManager.get())
  ipcMain.handle('save-settings', (_, settings) => settingsManager.set(settings))

  ipcMain.handle('toggle-mod', async (_, gameId, modId, enabled) => {
    try {
      if (enabled) {
        return await pluginManager.enableMod(gameId, modId)
      } else {
        return await pluginManager.disableMod(gameId, modId)
      }
    } catch (e) {
      console.error(e)
      return false
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

  ipcMain.handle('delete-extension', async (_, id) => {
    return await pluginManager.deleteExtension(id)
  })

  // install-extension-dialog: Now returns content preview if possible
  ipcMain.handle('install-extension-dialog', async (_) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Mod Manager Extensions', extensions: ['modmanager', 'zip'] }]
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

  ipcMain.handle('export-extensions', async (_, extensionIds) => {
    try {
      // Create a zip containing all selected extensions

      // Better approach: Let pluginManager handle the bulk export
      const buffer = await pluginManager.exportExtensionsBulk(extensionIds)
      if (!buffer) return false

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `modmanager-bundle.modmanager`,
        filters: [{ name: 'Mod Manager Extension Bundle', extensions: ['modmanager'] }]
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
        defaultPath: `${gameId}.modmanager`,
        filters: [{ name: 'Mod Manager Extension', extensions: ['modmanager'] }]
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

  ipcMain.handle('create-modpack-dialog', async (_, gameId, meta) => {
    // meta includes title, author, version, description, imagePath (optional)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${(meta.title || 'modpack').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.modpack`,
      filters: [{ name: 'Modpack', extensions: ['modpack'] }]
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
      filters: [{ name: 'Modpack', extensions: ['modpack'] }]
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

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
