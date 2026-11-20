import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { bindSmartSpectraIpc } from '@smartspectra/node-sdk/main'
import { createAppUrlMatcher } from './appUrl'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export const isAppUrl = createAppUrlMatcher({
  isDev: is.dev,
  devUrl: process.env['ELECTRON_RENDERER_URL'],
  rendererIndexPath: join(__dirname, '../renderer/index.html')
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    backgroundColor: '#0b0b0f',
    title: 'Poker Face',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  // The SDK runs here; the renderer feeds it camera frames. The binding releases the SDK when the
  // renderer's MessagePort closes (window closed or reloaded, or the renderer process is gone).
  bindSmartSpectraIpc(mainWindow)

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  // Closing the window (Alt+F4, the close button) while the SDK runs aborted the process: the
  // native SDK threw during teardown. Hold the close until the renderer has stopped the camera
  // session, or 3 s at most, then close for real.
  let cameraReleased = false
  mainWindow.on('close', (event) => {
    const win = mainWindow
    if (cameraReleased || !win) return
    event.preventDefault()
    const finish = (): void => {
      if (cameraReleased) return
      cameraReleased = true
      clearTimeout(timer)
      ipcMain.removeListener('app:cameraReleased', onReleased)
      if (!win.isDestroyed()) win.close()
    }
    const onReleased = (e: Electron.IpcMainEvent): void => {
      if (e.sender === win.webContents) finish()
    }
    const timer = setTimeout(finish, 3000)
    ipcMain.on('app:cameraReleased', onReleased)
    win.webContents.send('app:closing')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isHttps(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // The window may only ever show our own page: block every other navigation.
  mainWindow.webContents.on('will-navigate', (event) => {
    if (!isAppUrl(event.url)) event.preventDefault()
  })
  mainWindow.webContents.on('will-frame-navigate', (event) => {
    if (!isAppUrl(event.url)) event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.teofurlan.pokerface')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  registerIpc(() => mainWindow, isAppUrl)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
