import { describe, expect, it } from 'vitest'
import type { FaceStatus } from '../face/faceSession'
import { createRecordedFace, type Recording } from './recordedFace'

const CLASSES = ['ANGRY', 'CONTEMPT', 'DISGUST', 'FEAR', 'HAPPY', 'NEUTRAL', 'SAD', 'SURPRISE']

const recording: Recording = {
  classes: CLASSES,
  durationMs: 1000,
  expressions: [
    [0, 0, 0, 0, 0, 0, 100, 0, 0],
    [100, 0, 0, 0, 0, 0, 90, 10, 0],
    [300, 0, 0, 0, 0, 0, 80, 20, 0]
  ],
  pulse: [[200, 70]],
  breathing: [[250, 15]]
}

interface FakeClock {
  now: () => number
  setTimer: (fn: () => void, ms: number) => () => void
  pending: () => number
  advance: (ms: number) => void
}

interface Setup {
  clock: FakeClock
  source: ReturnType<typeof createRecordedFace>
  events: { at: number; status: FaceStatus }[]
}

// A manual clock: advance() runs due timers in order, like the real event loop would.
function fakeClock(): FakeClock {
  let time = 0
  let nextId = 1
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => time,
    setTimer(fn: () => void, ms: number): () => void {
      const id = nextId++
      timers.set(id, { at: time + ms, fn })
      return () => void timers.delete(id)
    },
    pending: () => timers.size,
    advance(ms: number): void {
      const target = time + ms
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        time = Math.max(time, due[1].at)
        due[1].fn()
      }
      time = target
    }
  }
}

function setup(rec: Recording = recording): Setup {
  const clock = fakeClock()
  const source = createRecordedFace({ recording: rec, now: clock.now, setTimer: clock.setTimer })
  const events: { at: number; status: FaceStatus }[] = []
  source.onStatus((status) => events.push({ at: clock.now(), status }))
  return { clock, source, events }
}

describe('recorded face source', () => {
  it('starts ok, reports no stream, and emits a valid face status right away', async () => {
    const { source, events } = setup()
    const streams: unknown[] = []
    source.onStream((s) => streams.push(s))
    expect(await source.start('ignored')).toEqual({ ok: true })
    expect(streams).toEqual([null])
    expect(events[0].status.validationCode).toBe(0)
    expect(events[0].status.faceDetected).toBe(true)
    expect(events[0].status.talking).toBe(false)
  })

  it('emits expression samples in order at their recorded offsets', async () => {
    const { clock, source, events } = setup()
    await source.start('x')
    clock.advance(350)
    const withExpr = events.filter((e) => e.status.expressions)
    expect(withExpr.map((e) => e.at)).toEqual([0, 100, 300])
    expect(withExpr.map((e) => e.status.expressions?.SAD)).toEqual([0, 10, 20])
    expect(withExpr.every((e) => e.status.validationCode === 0)).toBe(true)
    expect(withExpr[0].status.expressions?.NEUTRAL).toBe(100)
  })

  it('does not emit a sample before its offset', async () => {
    const { clock, source, events } = setup()
    await source.start('x')
    clock.advance(99)
    expect(events.filter((e) => e.status.expressions)).toHaveLength(1)
  })

  it('emits pulse and breathing at their spread times, only on their own events', async () => {
    const { clock, source, events } = setup()
    await source.start('x')
    clock.advance(300)
    const pulse = events.find((e) => e.status.pulse)
    const breathing = events.find((e) => e.status.breathing)
    expect(pulse?.at).toBe(200)
    expect(pulse?.status.pulse).toEqual({ value: 70, confidence: 1, stable: true })
    expect(pulse?.status.expressions).toBeUndefined()
    expect(breathing?.at).toBe(250)
    expect(breathing?.status.breathing?.value).toBe(15)
  })

  it('stop halts emission and cancels timers', async () => {
    const { clock, source, events } = setup()
    await source.start('x')
    clock.advance(150)
    const count = events.length
    await source.stop()
    expect(clock.pending()).toBe(0)
    clock.advance(5000)
    expect(events).toHaveLength(count)
  })

  it('loops after the end so a long round keeps getting samples', async () => {
    const { clock, source, events } = setup()
    await source.start('x')
    clock.advance(2500)
    const times = events.filter((e) => e.status.expressions).map((e) => e.at)
    expect(times.filter((t) => t >= 1000).length).toBeGreaterThan(0)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('restarts the recording clock on a new start (rematch)', async () => {
    const { clock, source, events } = setup()
    await source.start('x')
    clock.advance(400)
    await source.stop()
    events.length = 0
    clock.advance(1000)
    await source.start('x')
    const base = clock.now()
    clock.advance(120)
    expect(events.filter((e) => e.status.expressions).map((e) => e.at - base)).toEqual([0, 100])
  })

  it('stops listeners from receiving events after unsubscribe', async () => {
    const { clock, source } = setup()
    const got: FaceStatus[] = []
    const off = source.onStatus((s) => got.push(s))
    await source.start('x')
    off()
    const n = got.length
    clock.advance(400)
    expect(got).toHaveLength(n)
  })

  it('never touches window.api or the SDK', async () => {
    const g = globalThis as { window?: unknown }
    const before = g.window
    let touched = false
    g.window = new Proxy({}, { get: () => ((touched = true), undefined) })
    try {
      const { clock, source } = setup()
      await source.start('x')
      clock.advance(400)
      await source.stop()
    } finally {
      g.window = before
    }
    expect(touched).toBe(false)
  })
})
