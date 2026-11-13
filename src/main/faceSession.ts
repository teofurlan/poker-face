// One live SmartSpectra session in the main process: face metrics only, telemetry off.
// Every session spends Presage credits, so stopping must never hang.

export interface SdkLike {
  useCamera(selection: unknown): void
  start(): void
  stopAsync(): Promise<void>
  destroy(): Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown
}

export interface SdkOptions {
  apiKey: string
  requestedMetrics: number[]
  enableTelemetry: false
}

export interface FaceStatus {
  running: boolean
  faceDetected: boolean
  validation: string
  lastFaceAt: number | null
  error: string | null
}

export type StopResult = 'stopped' | 'forced' | 'idle'

interface Deps {
  createSdk: (options: SdkOptions) => SdkLike
  decode: (buf: Buffer) => unknown
  faceMetrics: readonly number[]
  stopTimeoutMs?: number
  now?: () => number
}

const VALIDATION: Record<number, string> = {
  0: 'Face OK',
  1: 'No face found',
  2: 'Only one face in frame',
  3: 'Center your face',
  4: 'Move closer or further',
  5: 'Too dark',
  6: 'Too bright',
  7: 'Show your chest',
  10: 'Camera adjusting',
  11: 'Camera too slow',
  12: 'Hold still',
  13: 'Move back a little',
  14: 'Come closer',
  15: 'Move the camera down or sit lower',
  16: 'Move the camera up or sit higher',
  17: 'Look at the camera'
}

export function describeValidation(code: number): string {
  return VALIDATION[code] ?? 'Adjusting'
}

export function createFaceSession(deps: Deps): {
  start: (
    args: { apiKey: string; cameraId: string },
    onStatus: (s: FaceStatus) => void
  ) => Promise<void>
  stop: () => Promise<StopResult>
  isRunning: () => boolean
} {
  const now = deps.now ?? Date.now
  const stopTimeoutMs = deps.stopTimeoutMs ?? 3000
  // The SDK stays tracked until stopAsync + destroy have really finished, never earlier.
  let sdk: SdkLike | null = null
  let stopping: Promise<StopResult> | null = null
  let forced = false

  async function start(
    args: { apiKey: string; cameraId: string },
    onStatus: (s: FaceStatus) => void
  ): Promise<void> {
    if (stopping) await stopping
    if (forced) throw new Error('The previous camera session could not be stopped; app is closing.')
    if (sdk) throw new Error('A face session is already running.')
    const status: FaceStatus = {
      running: true,
      faceDetected: false,
      validation: 'Starting camera',
      lastFaceAt: null,
      error: null
    }
    const emit = (patch: Partial<FaceStatus>): void => {
      Object.assign(status, patch)
      onStatus({ ...status })
    }
    const s = deps.createSdk({
      apiKey: args.apiKey,
      requestedMetrics: [...deps.faceMetrics],
      enableTelemetry: false
    })
    s.on('validationStatus', (code: number) => {
      emit({ validation: describeValidation(code), ...(code === 1 ? { faceDetected: false } : {}) })
    })
    s.on('metrics', (buf: Buffer) => {
      const m = deps.decode(buf) as { face?: { expression?: unknown[] } }
      if (m.face?.expression?.length) emit({ faceDetected: true, lastFaceAt: now() })
    })
    s.on('error', (code: number, message: string) => {
      emit({ error: `${message} (code ${code})` })
    })
    s.useCamera({ kind: 'byId', id: args.cameraId })
    sdk = s
    s.start()
    emit({})
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
        await s.stopAsync()
      } catch {
        ok = false
      }
      try {
        await s.destroy()
      } catch {
        ok = false
      }
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
