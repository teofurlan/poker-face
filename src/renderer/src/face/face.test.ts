import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdks: FakeSdk[] = []

class FakeSdk extends EventEmitter {
  stopped = false
  destroyed = false
  constructor() {
    super()
    sdks.push(this)
  }
  useMediaStream(): this {
    return this
  }
  started = false
  async start(): Promise<void> {
    this.started = true
  }
  async stop(): Promise<void> {
    this.stopped = true
  }
  destroy(): void {
    this.destroyed = true
  }
}

vi.mock('@smartspectra/node-sdk/renderer', () => ({
  SmartSpectraSDK: FakeSdk,
  faceMetrics: [1],
  cardioMetrics: [],
  breathingMetrics: []
}))
vi.mock('@smartspectra/node-sdk/messages', () => ({ decodeMetrics: () => ({}) }))

const streams: { stopped: number }[] = []

beforeEach(() => {
  sdks.length = 0
  streams.length = 0
  vi.stubGlobal('window', {
    api: { keyForSession: vi.fn(async () => 'key'), forceExit: vi.fn(async () => {}) }
  })
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => {
        const stream = { stopped: 0, getTracks: () => [{ stop: () => (stream.stopped += 1) }] }
        streams.push(stream)
        return stream
      }
    }
  })
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('face', () => {
  it('cancels a start that a stop called in the same tick (React StrictMode start, stop, start)', async () => {
    const { face } = await import('./face')
    const first = face.start('cam-1')
    const stopping = face.stop()
    const second = face.start('cam-1')
    await expect(first).resolves.toEqual({ ok: false, error: 'Camera start was cancelled.' })
    await stopping
    await expect(second).resolves.toEqual({ ok: true })
    expect(sdks.filter((s) => !s.destroyed)).toHaveLength(1)
    expect(streams.filter((s) => s.stopped === 0)).toHaveLength(1)
    await face.stop()
  })

  it('returns an error instead of rejecting when the key cannot be read', async () => {
    const { face } = await import('./face')
    ;(window.api.keyForSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('read failed')
    )
    await expect(face.start('cam-1')).resolves.toEqual({ ok: false, error: 'read failed' })
    expect(sdks).toHaveLength(0)
  })

  it('shows preview during warm-up and cancels immediately on stop without creating an SDK', async () => {
    const { face } = await import('./face')
    const seenStreams: (MediaStream | null)[] = []
    const off = face.onStream((s) => seenStreams.push(s))
    try {
      const startedAt = Date.now()
      const starting = face.start('cam-1')
      await vi.waitFor(() => expect(streams).toHaveLength(1))
      expect(seenStreams.at(-1)).toBe(streams[0])
      expect(sdks).toHaveLength(0)

      const stopping = face.stop()
      await expect(starting).resolves.toEqual({
        ok: false,
        error: 'Face session start was cancelled.'
      })
      await expect(stopping).resolves.toBe('stopped')
      expect(Date.now() - startedAt).toBeLessThan(1000)
      expect(streams[0].stopped).toBe(1)
      expect(seenStreams.at(-1)).toBeNull()
      expect(sdks).toHaveLength(0)
    } finally {
      off()
    }
  })
})
