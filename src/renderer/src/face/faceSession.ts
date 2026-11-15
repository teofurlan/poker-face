// One live SmartSpectra session, run from the renderer so the same camera stream can be previewed.
// The renderer owns the camera stream; the SDK's main-process side does the processing.
// Telemetry is always off. Every session spends Presage credits, so stopping must never hang.
import { describeValidation } from '../game/calibration'

export interface StreamLike {
  getTracks(): { stop: () => void }[]
}

export interface SdkLike {
  useMediaStream(stream: StreamLike): unknown
  start(): Promise<void>
  stop(): Promise<void>
  destroy(): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown
}

export interface SdkOptions {
  apiKey: string
  requestedMetrics: number[]
  enableTelemetry: false
}

export const EXPR_CLASSES = [
  'ANGRY',
  'CONTEMPT',
  'DISGUST',
  'FEAR',
  'HAPPY',
  'NEUTRAL',
  'SAD',
  'SURPRISE'
] as const

export interface FaceStatus {
  running: boolean
  faceDetected: boolean
  validation: string
  validationCode: number
  lastFaceAt: number | null
  error: string | null
  expressions?: Record<string, number>
  pulse?: { value: number; confidence: number; stable: boolean }
  breathing?: { value: number; confidence: number; stable: boolean }
  talking?: boolean
}

export type StopResult = 'stopped' | 'forced' | 'idle'

interface Deps {
  createSdk: (options: SdkOptions) => SdkLike
  decode: (buf: Uint8Array) => unknown
  acquireStream: (cameraId: string) => Promise<StreamLike>
  faceMetrics: readonly number[]
  stopTimeoutMs?: number
  now?: () => number
}

export function createFaceSession(deps: Deps): {
  start: (
    args: { apiKey: string; cameraId: string },
    onStatus: (s: FaceStatus) => void
  ) => Promise<StreamLike>
  stop: () => Promise<StopResult>
  isRunning: () => boolean
} {
  const now = deps.now ?? Date.now
  const stopTimeoutMs = deps.stopTimeoutMs ?? 3000
  // The SDK stays tracked until stopAsync + destroy have really finished, never earlier.
  let sdk: SdkLike | null = null
  let stream: StreamLike | null = null
  let stopping: Promise<StopResult> | null = null
  let forced = false

  async function start(
    args: { apiKey: string; cameraId: string },
    onStatus: (s: FaceStatus) => void
  ): Promise<StreamLike> {
    if (stopping) await stopping
    if (forced) throw new Error('The previous camera session could not be stopped; app is closing.')
    if (sdk) throw new Error('A face session is already running.')
    const status: FaceStatus = {
      running: true,
      faceDetected: false,
      validation: 'Starting camera',
      validationCode: -1,
      lastFaceAt: null,
      error: null
    }
    const emit = (patch: Partial<FaceStatus>): void => {
      Object.assign(status, patch)
      onStatus({ ...status })
    }
    const camera = await deps.acquireStream(args.cameraId)
    const s = deps.createSdk({
      apiKey: args.apiKey,
      requestedMetrics: [...deps.faceMetrics],
      enableTelemetry: false
    })
    s.on('validationStatus', (code: number) => {
      emit({
        validationCode: code,
        validation: describeValidation(code),
        ...(code === 1 ? { faceDetected: false } : {})
      })
    })
    s.on('metrics', (buf: Uint8Array) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = deps.decode(buf) as any
      const patch: Partial<FaceStatus> = {}
      if (m?.face?.expression?.length) {
        patch.faceDetected = true
        patch.lastFaceAt = now()
        const exprSample = m.face.expression[0]
        if (exprSample?.scores) {
          const scoresRecord: Record<string, number> = {}
          for (const name of EXPR_CLASSES) {
            const match = exprSample.scores.find(
              (x: { type: number | string; confidence: number }) =>
                EXPR_CLASSES[x.type as number] === name || x.type === name
            )
            scoresRecord[name] = match?.confidence ?? 0
          }
          patch.expressions = scoresRecord
        }
      }
      if (m?.cardio?.pulseRate?.length) {
        const p = m.cardio.pulseRate[0]
        patch.pulse = { value: p.value, confidence: p.confidence, stable: Boolean(p.stable) }
      }
      if (m?.breathing?.rate?.length) {
        const b = m.breathing.rate[0]
        patch.breathing = { value: b.value, confidence: b.confidence, stable: Boolean(b.stable) }
      }
      if (m?.face?.talking?.length) {
        patch.talking = Boolean(m.face.talking[0]?.detected)
      }
      emit(patch)
    })
    s.on('error', (code: number, message: string) => {
      emit({ error: `${message} (code ${code})` })
    })
    s.useMediaStream(camera)
    sdk = s
    stream = camera
    emit({})
    try {
      await s.start()
    } catch (err) {
      await stop()
      throw err
    }
    return camera
  }

  function stop(): Promise<StopResult> {
    if (stopping) return stopping
    const s = sdk
    if (!s) return Promise.resolve('idle')
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<'forced'>((resolve) => {
      timer = setTimeout(() => resolve('forced'), stopTimeoutMs)
    })
    const done = (async (): Promise<StopResult> => {
      let ok = true
      try {
        await s.stop()
      } catch {
        ok = false
      }
      try {
        s.destroy()
      } catch {
        ok = false
      }
      // The host owns the camera stream, so it releases it once the SDK has let go.
      for (const track of stream?.getTracks() ?? []) track.stop()
      stream = null
      return ok ? 'stopped' : 'forced'
    })()
    const run = (async (): Promise<StopResult> => {
      try {
        const result = await Promise.race([done, timeout])
        if (result === 'stopped') sdk = null
        else forced = true
        return result
      } finally {
        clearTimeout(timer)
        stopping = null
      }
    })()
    stopping = run
    return run
  }

  return { start, stop, isRunning: () => sdk !== null }
}
