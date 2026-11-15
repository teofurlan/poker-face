import { contextBridge, ipcRenderer } from 'electron'
// Exposes the SDK's own bridge (window.__smartspectraBridge) for @smartspectra/node-sdk/renderer.
import '@smartspectra/node-sdk/preload'

export interface CameraInfo {
  id: string
  name: string
}

const api = {
  keyStatus: (): Promise<{ source: 'env' | 'stored' | null }> => ipcRenderer.invoke('key:status'),
  saveKey: (key: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('key:save', key),
  // Read only when a camera session starts: the renderer SDK forwards it to the main process.
  keyForSession: (): Promise<string | null> => ipcRenderer.invoke('key:forSession'),
  rememberedCamera: (cameras: CameraInfo[]): Promise<string | null> =>
    ipcRenderer.invoke('cameras:remembered', cameras),
  chooseCamera: (camera: CameraInfo): Promise<void> => ipcRenderer.invoke('camera:choose', camera),
  forceExit: (): Promise<void> => ipcRenderer.invoke('face:forceExit')
}

export type PokerFaceApi = typeof api

contextBridge.exposeInMainWorld('api', api)
