import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createFaceSession, type SdkLike, type StreamLike } from './faceSession'

class FakeStream implements StreamLike {
  stopped = 0
  getTracks(): { stop: () => void }[] {
    return [{ stop: () => void (this.stopped += 1) }]
  }
}

class FakeSdk extends EventEmitter implements SdkLike {
  stream: unknown = null
  started = false
  stopCalls = 0
  destroyCalls = 0
  hangStop = false
  rejectStop = false
  rejectDestroy = false
  releaseStop: (() => void) | null = null
  holdStop = false
  useMediaStream(stream: StreamLike): this {
    this.stream = stream
    return this
  }
  async start(): Promise<void> {
    this.started = true
  }
  stop(): Promise<void> {
    this.stopCalls += 1
    if (this.rejectStop) return Promise.reject(new Error('stop failed'))
    if (this.holdStop) return new Promise((resolve) => (this.releaseStop = resolve))
    return this.hangStop ? new Promise(() => {}) : Promise.resolve()
  }
  destroy(): void {
    this.destroyCalls += 1
    if (this.rejectDestroy) throw new Error('destroy failed')
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(decoded: unknown = { face: { expression: [{ scores: [] }] } }) {
  const sdk = new FakeSdk()
  const streams: FakeStream[] = []
  const requestedCameras: string[] = []
  let failCamera: string | null = null
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
    acquireStream: async (cameraId) => {
      requestedCameras.push(cameraId)
      if (failCamera) throw new Error(failCamera)
      const stream = new FakeStream()
      streams.push(stream)
      return stream
    },
    faceMetrics: [42],
    stopTimeoutMs: 50,
    now: () => 1000
  })
  return {
    sdk,
    created,
    options,
    statuses,
    session,
    streams,
    requestedCameras,
    failCameraWith: (message: string) => (failCamera = message),
    onStatus: (s: unknown) => statuses.push(s)
  }
}

describe('face session', () => {
  it('feeds the chosen camera stream to the SDK with the requested metrics and telemetry off', async () => {
    const { sdk, options, session, streams, requestedCameras, onStatus } = setup()
    const stream = await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    expect(requestedCameras).toEqual(['cam-1'])
    expect(options).toEqual([{ apiKey: 'k', requestedMetrics: [42], enableTelemetry: false }])
    expect(sdk.stream).toBe(streams[0])
    expect(stream).toBe(streams[0])
    expect(sdk.started).toBe(true)
  })

  it('creates no SDK and rejects when the camera cannot be opened', async () => {
    const { created, session, failCameraWith, onStatus } = setup()
    failCameraWith('Could not start video source')
    await expect(session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)).rejects.toThrow(
      'Could not start video source'
    )
    expect(created).toHaveLength(0)
    expect(session.isRunning()).toBe(false)
  })

  it('reports a detected face when expression samples arrive', async () => {
    const { sdk, statuses, session, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    sdk.emit('validationStatus', 0, 0, '')
    sdk.emit('metrics', new Uint8Array(0), 0)
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
    sdk.emit('metrics', new Uint8Array(0), 0)
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

  it('stops and destroys the SDK and releases the camera', async () => {
    const { sdk, session, streams, onStatus } = setup()
    await session.start({ apiKey: 'k', cameraId: 'cam-1' }, onStatus)
    await expect(session.stop()).resolves.toBe('stopped')
    expect([sdk.stopCalls, sdk.destroyCalls, streams[0].stopped]).toEqual([1, 1, 1])
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

  it('still destroys and resolves forced when stop rejects', async () => {
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
