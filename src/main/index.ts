import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { bindSmartSpectraIpc } from '@smartspectra/node-sdk/main'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null

const rendererIndexUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// The app's own page: the dev server origin in development, the packaged index.html otherwise.
export function isAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (is.dev && devUrl) return parsed.origin === new URL(devUrl).origin
    if (parsed.protocol !== 'file:') return false
    const href = pathToFileURL(fileURLToPath(parsed)).href
    // Windows paths are case-insensitive and Chromium may report a different drive-letter case.
    return process.platform === 'win32'
      ? href.toLowerCase() === rendererIndexUrl.toLowerCase()
      : href === rendererIndexUrl
  } catch {
    return false
  }
}

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
