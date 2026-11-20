// The app's single camera + SDK session. The renderer opens the chosen camera, shows it as a
// preview and feeds the same stream to the SDK, whose processing runs in the main process.
import {
  SmartSpectraSDK,
  breathingMetrics,
  cardioMetrics,
  faceMetrics
} from '@smartspectra/node-sdk/renderer'
import { decodeMetrics } from '@smartspectra/node-sdk/messages'
import { createFaceSession, type FaceStatus, type SdkLike, type StopResult } from './faceSession'

export interface CameraInfo {
  id: string
  name: string
}

const statusListeners = new Set<(status: FaceStatus) => void>()
const streamListeners = new Set<(stream: MediaStream | null) => void>()
let currentStream: MediaStream | null = null

function setStream(stream: MediaStream | null): void {
  if (currentStream === stream) return
  currentStream = stream
  for (const listener of streamListeners) listener(stream)
}

const session = createFaceSession({
  createSdk: (options) => new SmartSpectraSDK(options) as unknown as SdkLike,
  decode: (buf) => decodeMetrics(buf),
  acquireStream: (cameraId) =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: { exact: cameraId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }
    }),
  faceMetrics: [...faceMetrics, ...cardioMetrics, ...breathingMetrics],
  // SmartSpectra's renderer SDK calls _tryLockCameraParameters() at pipeline start, locking
  // exposure to manual; showing the preview for 1.5 s first lets webcam auto-exposure settle.
  warmupMs: 1500,
  onStream: (s) => setStream(s as MediaStream | null)
})

// Starts run one at a time; a stop() bumps the epoch so starts still waiting for the key give up.
let startChain: Promise<unknown> = Promise.resolve()
let epoch = 0

async function startOnce(
  cameraId: string,
  myEpoch: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cancelled = { ok: false, error: 'Camera start was cancelled.' } as const
  if (myEpoch !== epoch) return cancelled
  try {
    const apiKey = await window.api.keyForSession()
    if (myEpoch !== epoch) return cancelled
    if (!apiKey) return { ok: false, error: 'No API key yet.' }
    const stream = await session.start({ apiKey, cameraId }, (status) => {
      for (const listener of statusListeners) listener(status)
    })
    if (myEpoch !== epoch) return cancelled
    setStream(stream as MediaStream)
    return { ok: true }
  } catch (err) {
    // A start that failed and could not stop its session may still be billing.
    if ((err as { forced?: boolean } | null)?.forced) await window.api.forceExit().catch(() => {})
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export const face = {
  start(cameraId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    // Take the epoch now, not when the queued start runs, so a stop called right after cancels it.
    const myEpoch = epoch
    const run = startChain.then(() => startOnce(cameraId, myEpoch))
    startChain = run.catch(() => undefined)
    return run
  },

  async stop(): Promise<StopResult> {
    epoch += 1
    const result = await session.stop()
    setStream(null)
    // A session that would not stop may still be billing: only ending the app guarantees it ends.
    if (result === 'forced') await window.api.forceExit()
    return result
  },

  onStatus(listener: (status: FaceStatus) => void): () => void {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  },

  onStream(listener: (stream: MediaStream | null) => void): () => void {
    streamListeners.add(listener)
    listener(currentStream)
    return () => streamListeners.delete(listener)
  }
}

export async function listCameras(): Promise<CameraInfo[]> {
  const videoInputs = async (): Promise<MediaDeviceInfo[]> =>
    (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  let devices = await videoInputs()
  // Camera names stay hidden until the page has used a camera once, so open and close one.
  if (devices.some((d) => !d.label)) {
    const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    for (const track of probe.getTracks()) track.stop()
    devices = await videoInputs()
  }
  return devices.map((d, i) => ({ id: d.deviceId, name: d.label || `Camera ${i + 1}` }))
}
