import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createFaceSession, describeValidation, type SdkLike } from './faceSession'

class FakeSdk extends EventEmitter implements SdkLike {
  camera: unknown = null
  started = false
  stopCalls = 0
  destroyCalls = 0
  hangStop = false
  useCamera(selection: unknown): void {
    this.camera = selection
  }
  start(): void {
    this.started = true
  }
  stopAsync(): Promise<void> {
    this.stopCalls += 1
    return this.hangStop ? new Promise(() => {}) : Promise.resolve()
  }
  async destroy(): Promise<void> {
    this.destroyCalls += 1
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(decoded: unknown = { face: { expression: [{ scores: [] }] } }) {
  const sdk = new FakeSdk()
  const options: unknown[] = []
  const statuses: unknown[] = []
  const session = createFaceSession({
    createSdk: (opts) => {
      options.push(opts)
      return sdk
    },
    decode: () => decoded,
    faceMetrics: [42],
    stopTimeoutMs: 50,
    now: () => 1000
  })
  return { sdk, options, statuses, session, onStatus: (s: unknown) => statuses.push(s) }
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
  it('requests face metrics only, telemetry off, on the chosen camera', () => {
    const { sdk, options, session, onStatus } = setup()
    session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    expect(options).toEqual([{ apiKey: 'k', requestedMetrics: [42], enableTelemetry: false }])
    expect(sdk.camera).toEqual({ kind: 'byId', id: 'cam-1' })
    expect(sdk.started).toBe(true)
  })

  it('reports a detected face when expression samples arrive', () => {
    const { sdk, statuses, session, onStatus } = setup()
    session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('validationStatus', 0, 0, '')
    sdk.emit('metrics', Buffer.alloc(0), 0)
    expect(statuses.at(-1)).toEqual({
      running: true,
      faceDetected: true,
      validation: 'Face OK',
      lastFaceAt: 1000,
      error: null
    })
  })

  it('reports no face when the SDK says so', () => {
    const { sdk, statuses, session, onStatus } = setup()
    session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('validationStatus', 1, 0, '')
    expect(statuses.at(-1)).toMatchObject({ faceDetected: false, validation: 'No face found' })
  })

  it('surfaces SDK errors', () => {
    const { sdk, statuses, session, onStatus } = setup()
    session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('error', 7, 'camera busy', false)
    expect(statuses.at(-1)).toMatchObject({ error: 'camera busy (code 7)' })
  })

  it('stops and destroys the SDK', async () => {
    const { sdk, session, onStatus } = setup()
    session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    await expect(session.stop()).resolves.toBe('stopped')
    expect([sdk.stopCalls, sdk.destroyCalls]).toEqual([1, 1])
    await expect(session.stop()).resolves.toBe('idle')
  })

  it('gives up after the timeout when stop hangs, so the caller can force quit', async () => {
    vi.useRealTimers()
    const { sdk, session, onStatus } = setup()
    session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.hangStop = true
    await expect(session.stop()).resolves.toBe('forced')
  })
})
