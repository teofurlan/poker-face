import { app, ipcMain, safeStorage, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  SmartSpectraSDK,
  decodeMetrics,
  faceMetrics,
  cardioMetrics,
  breathingMetrics
} from '@smartspectra/node-sdk'
import { createKeyStore } from './apiKey'
import { pickRememberedCamera, type CameraInfo } from './camera'
import { createFaceSession, type SdkLike } from './faceSession'

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

function listCameras(): CameraInfo[] {
  return SmartSpectraSDK.availableCameras().map((c, i) => ({
    id: c.id,
    name: c.name ?? `Camera ${i + 1}`
  }))
}

export const faceSession = createFaceSession({
  createSdk: (options) => new SmartSpectraSDK(options) as unknown as SdkLike,
  decode: decodeMetrics,
  faceMetrics: [...faceMetrics, ...cardioMetrics, ...breathingMetrics]
})

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('key:status', () => ({ source: keyStore.resolve().source }))
  ipcMain.handle('key:save', (_e, key: string) => keyStore.save(String(key ?? '')))

  ipcMain.handle('cameras:list', () => {
    try {
      const cameras = listCameras()
      return {
        cameras,
        selectedId: pickRememberedCamera(cameras, rememberedCamera())?.id ?? null
      }
    } catch (err) {
      return {
        cameras: [] as CameraInfo[],
        selectedId: null,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })
  ipcMain.handle('camera:choose', (_e, camera: CameraInfo) => {
    writeFile(cameraFile, JSON.stringify({ id: camera.id, name: camera.name }))
  })

  ipcMain.handle('face:start', async (_e, cameraId: string) => {
    const { key } = keyStore.resolve()
    if (!key) return { ok: false, error: 'No API key yet.' }
    try {
      await faceSession.start({ apiKey: key, cameraId }, (status) => {
        getWindow()?.webContents.send('face:status', status)
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.handle('face:stop', async () => {
    const result = await faceSession.stop()
    // A session that would not stop may still be billing: only ending the process guarantees it ends.
    if (result === 'forced') app.exit(3)
    return result
  })
}
