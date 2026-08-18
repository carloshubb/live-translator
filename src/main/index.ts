import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initMain as initAudioLoopback } from 'electron-audio-loopback'
import { loadSettings, registerSettingsIpc } from './settings'
import { registerOllamaIpc } from './ollama'
import { registerTtsIpc } from './tts'
import { registerTranslateIpc } from './translate'
import { registerOverlayIpc, openOverlay, closeOverlay } from './overlay'
import { startSttServer } from './sttServer'
import { registerVbCableIpc } from './vbcable'
import icon from '../../resources/icon.png?asset'

// Must be called before app is ready — registers the loopback
// audio handlers that override getDisplayMedia in the renderer.
initAudioLoopback()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 980,
    height: 740,
    minWidth: 720,
    minHeight: 560,
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

  // Asosiy oyna yopilsa, overlay yetim qolib app osilib turmasin
  mainWindow.on('closed', () => {
    closeOverlay()
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
  electronApp.setAppUserModelId('uz.tilmoch')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerSettingsIpc()
  registerOllamaIpc()
  registerTtsIpc()
  registerTranslateIpc()
  registerOverlayIpc()
  registerVbCableIpc()

  // STT serverni app o'zi boshqaradi: ishga tushiradi, o'chsa qayta ko'taradi
  startSttServer()

  createWindow()

  // Oxirgi sessiyada overlay yoniq bo'lsa, birga ochamiz
  if (loadSettings().overlayOpen) openOverlay()

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
