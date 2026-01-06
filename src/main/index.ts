import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PluginManager } from './pluginLoader'

const pluginManager = new PluginManager(process.cwd())

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
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

  ipcMain.handle('install-mod-dialog', async (event, gameId) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Mods', extensions: ['zip', 'rar', '7z', 'mod'] }]
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

  ipcMain.handle('get-mods', (event, gameId) => {
    return pluginManager.getMods(gameId)
  })

  ipcMain.handle('toggle-mod', async (event, gameId, modId, enabled) => {
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

  ipcMain.handle('install-extension-dialog', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Mod Manager Extensions', extensions: ['modmanager', 'zip'] }]
    })

    if (canceled || filePaths.length === 0) return false

    try {
      await pluginManager.installExtension(filePaths[0])
      return true
    } catch (err) {
      console.error('Extension install failed', err)
      return false
    }
  })

  ipcMain.handle('export-extension', async (event, gameId) => {
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
