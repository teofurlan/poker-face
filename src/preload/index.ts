import { contextBridge, ipcRenderer } from 'electron'

const api = {
  keyStatus: (): Promise<{ source: 'env' | 'stored' | null }> => ipcRenderer.invoke('key:status'),
  saveKey: (key: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('key:save', key),
  listCameras: (): Promise<{
    cameras: { id: string; name: string }[]
    selectedId: string | null
    error?: string
  }> => ipcRenderer.invoke('cameras:list'),
  chooseCamera: (camera: { id: string; name: string }): Promise<void> =>
    ipcRenderer.invoke('camera:choose', camera),
  startFace: (cameraId: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('face:start', cameraId),
  stopFace: (): Promise<'stopped' | 'forced' | 'idle'> => ipcRenderer.invoke('face:stop'),
  onFaceStatus: (listener: (status: FaceStatus) => void): (() => void) => {
    const handler = (_e: unknown, status: FaceStatus): void => listener(status)
    ipcRenderer.on('face:status', handler)
    return () => ipcRenderer.removeListener('face:status', handler)
  }
}

export interface FaceStatus {
  running: boolean
  faceDetected: boolean
  validation: string
  lastFaceAt: number | null
  error: string | null
}

export type PokerFaceApi = typeof api

contextBridge.exposeInMainWorld('api', api)
