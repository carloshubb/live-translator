import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { updateSettings } from './settings'

let overlayWin: BrowserWindow | null = null

export function openOverlay(): void {
  if (overlayWin) return
  createOverlay()
}

function createOverlay(): void {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const w = Math.min(880, screenW - 80)

  overlayWin = new BrowserWindow({
    width: w,
    height: 150,
    x: Math.round((screenW - w) / 2),
    y: screenH - 190, // ekran pastida, kino subtitle joylashuvi
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Fullscreen video ustida ham ko'rinsin
  overlayWin.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#overlay`)
  } else {
    overlayWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  }

  overlayWin.on('ready-to-show', () => overlayWin?.show())
  overlayWin.on('closed', () => {
    overlayWin = null
  })
}

export function registerOverlayIpc(): void {
  // Asosiy oynadan: overlay'ni ochish/yopish. Holatni qaytaradi va eslab qoladi.
  ipcMain.handle('overlay:toggle', (): boolean => {
    if (overlayWin) {
      overlayWin.close()
      updateSettings({ overlayOpen: false })
      return false
    }
    createOverlay()
    updateSettings({ overlayOpen: true })
    return true
  })

  ipcMain.handle('overlay:is-open', (): boolean => overlayWin !== null)

  // Asosiy oynadan kelgan subtitle'ni overlay oynasiga uzatamiz
  ipcMain.on('overlay:line', (_e, line: unknown) => {
    overlayWin?.webContents.send('overlay:line', line)
  })

  // Overlay o'zini yopish tugmasi (✕) — bu ham "o'chirilgan" deb eslab qolinadi
  ipcMain.on('overlay:close', () => {
    overlayWin?.close()
    updateSettings({ overlayOpen: false })
  })
}

export function closeOverlay(): void {
  overlayWin?.close()
}
