import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createFaceSession, describeValidation, type SdkLike } from './faceSession'

class FakeSdk extends EventEmitter implements SdkLike {
  camera: unknown = null
  started = false
  stopCalls = 0
  destroyCalls = 0
  hangStop = false
  rejectStop = false
  rejectDestroy = false
  releaseStop: (() => void) | null = null
  holdStop = false
  useCamera(selection: unknown): void {
    this.camera = selection
  }
  start(): void {
    this.started = true
  }
  stopAsync(): Promise<void> {
    this.stopCalls += 1
    if (this.rejectStop) return Promise.reject(new Error('stop failed'))
    if (this.holdStop) return new Promise((resolve) => (this.releaseStop = resolve))
    return this.hangStop ? new Promise(() => {}) : Promise.resolve()
  }
  async destroy(): Promise<void> {
    this.destroyCalls += 1
    if (this.rejectDestroy) throw new Error('destroy failed')
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(decoded: unknown = { face: { expression: [{ scores: [] }] } }) {
  const sdk = new FakeSdk()
  const created: FakeSdk[] = []
  const options: unknown[] = []
  const statuses: unknown[] = []
  const session = createFaceSession({
    createSdk: (opts) => {
      options.push(opts)
      if (created.length === 0) {
        created.push(sdk)
        return sdk
      }
      const next = new FakeSdk()
      created.push(next)
      return next
    },
    decode: () => decoded,
    faceMetrics: [42],
    stopTimeoutMs: 50,
    now: () => 1000
  })
  return { sdk, created, options, statuses, session, onStatus: (s: unknown) => statuses.push(s) }
}

describe('describeValidation', () => {
  it('maps SDK codes to short instructions', () => {
    expect(describeValidation(0)).toBe('Face OK')
    expect(describeValidation(1)).toBe('No face found')
    expect(describeValidation(2)).toBe('Only one face in frame')
    expect(describeValidation(5)).toBe('Too dark')
    expect(describeValidation(16)).toBe('Move the camera up or sit higher')
    expect(describeValidation(99)).toBe('Adjusting')
  })
})

describe('face session', () => {
  it('requests face metrics only, telemetry off, on the chosen camera', async () => {
    const { sdk, options, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    expect(options).toEqual([{ apiKey: 'k', requestedMetrics: [42], enableTelemetry: false }])
    expect(sdk.camera).toEqual({ kind: 'byId', id: 'cam-1' })
    expect(sdk.started).toBe(true)
  })

  it('reports a detected face when expression samples arrive', async () => {
    const { sdk, statuses, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('validationStatus', 0, 0, '')
    sdk.emit('metrics', Buffer.alloc(0), 0)
    expect(statuses.at(-1)).toEqual({
      running: true,
      faceDetected: true,
      validation: 'Face OK',
      validationCode: 0,
      lastFaceAt: 1000,
      error: null,
      expressions: {
        ANGRY: 0,
        CONTEMPT: 0,
        DISGUST: 0,
        FEAR: 0,
        HAPPY: 0,
        NEUTRAL: 0,
        SAD: 0,
        SURPRISE: 0
      }
    })
  })

  it('decodes pulse, breathing and talking when available in metrics', async () => {
    const customPayload = {
      face: {
        expression: [{ scores: [{ type: 4, confidence: 65 }] }],
        talking: [{ detected: true }]
      },
      cardio: {
        pulseRate: [{ value: 72, confidence: 95, stable: 1 }]
      },
      breathing: {
        rate: [{ value: 16, confidence: 88, stable: 1 }]
      }
    }
    const { sdk, statuses, session, onStatus } = setup(customPayload)
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('validationStatus', 0, 0, '')
    sdk.emit('metrics', Buffer.alloc(0), 0)
    const latest = statuses.at(-1) as Record<string, unknown>
    expect(latest.pulse).toEqual({ value: 72, confidence: 95, stable: true })
    expect(latest.breathing).toEqual({ value: 16, confidence: 88, stable: true })
    expect(latest.talking).toBe(true)
    const expr = latest.expressions as Record<string, number>
    expect(expr.HAPPY).toBe(65)
  })

  it('reports no face when the SDK says so', async () => {
    const { sdk, statuses, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('validationStatus', 1, 0, '')
    expect(statuses.at(-1)).toMatchObject({ faceDetected: false, validation: 'No face found' })
  })

  it('surfaces SDK errors', async () => {
    const { sdk, statuses, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('error', 7, 'camera busy', false)
    expect(statuses.at(-1)).toMatchObject({ error: 'camera busy (code 7)' })
  })

  it('stops and destroys the SDK', async () => {
    const { sdk, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    await expect(session.stop()).resolves.toBe('stopped')
    expect([sdk.stopCalls, sdk.destroyCalls]).toEqual([1, 1])
    await expect(session.stop()).resolves.toBe('idle')
  })

  it('gives up after the timeout when stop hangs, so the caller can force quit', async () => {
    vi.useRealTimers()
    const { sdk, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.hangStop = true
    await expect(session.stop()).resolves.toBe('forced')
  })

  it('keeps tracking the session while a stop hangs, and forces after the timeout', async () => {
    const { sdk, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.hangStop = true
    await expect(session.stop()).resolves.toBe('forced')
    expect(session.isRunning()).toBe(true)
  })

  it('stays running while stop is pending and is idle only after teardown completes', async () => {
    const { sdk, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.holdStop = true
    const pending = session.stop()
    expect(session.isRunning()).toBe(true)
    await vi.waitFor(() => expect(sdk.releaseStop).not.toBeNull())
    sdk.releaseStop?.()
    await expect(pending).resolves.toBe('stopped')
    expect(session.isRunning()).toBe(false)
  })

  it('still destroys and resolves forced when stopAsync rejects', async () => {
    const { sdk, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.rejectStop = true
    await expect(session.stop()).resolves.toBe('forced')
    expect(sdk.destroyCalls).toBe(1)
  })

  it('resolves forced (never rejects) when destroy rejects', async () => {
    const { sdk, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.rejectDestroy = true
    await expect(session.stop()).resolves.toBe('forced')
  })

  it('start waits for a pending stop before creating a new SDK', async () => {
    const { sdk, created, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.holdStop = true
    const stopping = session.stop()
    const restarting = session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    await new Promise((r) => setTimeout(r, 10))
    expect(created).toHaveLength(1)
    await vi.waitFor(() => expect(sdk.releaseStop).not.toBeNull())
    sdk.releaseStop?.()
    await stopping
    await restarting
    expect(created).toHaveLength(2)
    expect(created[1].started).toBe(true)
    expect(session.isRunning()).toBe(true)
  })

  it('does not start a new SDK when the pending stop was forced', async () => {
    const { sdk, created, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.hangStop = true
    const stopping = session.stop()
    const restarting = session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    await expect(stopping).resolves.toBe('forced')
    await expect(restarting).rejects.toThrow()
    await expect(session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)).rejects.toThrow()
    expect(created).toHaveLength(1)
  })

  it('rejects a second start while running', async () => {
    const { session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    await expect(session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)).rejects.toThrow(
      /already running/
    )
  })
})
