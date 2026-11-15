import { app, ipcMain, safeStorage, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createKeyStore } from './apiKey'
import { pickRememberedCamera, type CameraInfo } from './camera'

function readFile(path: string): Buffer | null {
  return existsSync(path) ? readFileSync(path) : null
}

function writeFile(path: string, data: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

const keyStore = createKeyStore({
  env: process.env,
  filePath: join(app.getPath('userData'), 'api-key.bin'),
  encryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (text) => safeStorage.encryptString(text),
  decrypt: (data) => safeStorage.decryptString(data),
  readFile,
  writeFile
})

const cameraFile = join(app.getPath('userData'), 'camera.json')

function rememberedCamera(): CameraInfo | null {
  try {
    const data = readFile(cameraFile)
    return data ? (JSON.parse(data.toString()) as CameraInfo) : null
  } catch {
    return null
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // Only our own window's main frame may ask for the key: the renderer SDK needs it to start a session.
  const fromOurWindow = (e: IpcMainInvokeEvent): boolean =>
    e.sender === getWindow()?.webContents && e.senderFrame === e.sender.mainFrame

  ipcMain.handle('key:status', () => ({ source: keyStore.resolve().source }))
  ipcMain.handle('key:save', (_e, key: string) => keyStore.save(String(key ?? '')))

  ipcMain.handle('key:forSession', (e) => {
    if (!fromOurWindow(e)) return null
    const { key } = keyStore.resolve()
    return key
  })

  ipcMain.handle(
    'cameras:remembered',
    (_e, cameras: CameraInfo[]) => pickRememberedCamera(cameras, rememberedCamera())?.id ?? null
  )
  ipcMain.handle('camera:choose', (_e, camera: CameraInfo) => {
    writeFile(cameraFile, JSON.stringify({ id: camera.id, name: camera.name }))
  })

  // A session that would not stop may still be billing: only ending the process guarantees it ends.
  ipcMain.handle('face:forceExit', () => app.exit(3))
}
