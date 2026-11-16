import { describe, expect, it } from 'vitest'
import { createSoundEngine, type AudioContextLike } from './engine'

class FakeParam {
  value = 0
  events: string[] = []
  setValueAtTime(v: number): void {
    this.value = v
    this.events.push(`set:${v}`)
  }
  linearRampToValueAtTime(v: number): void {
    this.events.push(`lin:${v}`)
  }
  exponentialRampToValueAtTime(v: number): void {
    this.events.push(`exp:${v}`)
  }
  setTargetAtTime(v: number): void {
    this.value = v
    this.events.push(`target:${v}`)
  }
  cancelScheduledValues(): void {
    this.events.push('cancel')
  }
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  Q = new FakeParam()
  type = ''
  buffer: unknown = null
  loop = false
  started = 0
  stopped = 0
  connect<T>(n: T): T {
    return n
  }
  disconnect(): void {
    this.started += 0
  }
  start(): void {
    this.started++
  }
  stop(): void {
    this.stopped++
  }
}
function makeFake(state: 'running' | 'suspended' = 'running'): {
  ctx: AudioContextLike
  log: { oscillators: number; sources: number; gains: FakeNode[]; resumes: number }
} {
  const log = { oscillators: 0, sources: 0, gains: [] as FakeNode[], resumes: 0 }
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createOscillator: () => (log.oscillators++, new FakeNode()),
    createBufferSource: () => (log.sources++, new FakeNode()),
    createGain: () => {
      const g = new FakeNode()
      log.gains.push(g)
      return g
    },
    createBiquadFilter: () => new FakeNode(),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    resume: async () => {
      log.resumes++
    }
  }
  return { ctx: ctx as unknown as AudioContextLike, log }
}

describe('sound engine', () => {
  it('plays every cue when unmuted', () => {
    const { ctx, log } = makeFake()
    const engine = createSoundEngine({ createContext: () => ctx })
    for (const cue of [
      { type: 'bell' },
      { type: 'crack' },
      { type: 'tick', urgency: 0.5 },
      { type: 'roundEnd' },
      { type: 'winner' }
    ] as const) {
      const before = log.oscillators + log.sources
      engine.play(cue)
      expect(log.oscillators + log.sources).toBeGreaterThan(before)
    }
  })

  it('plays nothing and never creates a context while muted', () => {
    const { ctx, log } = makeFake()
    let created = 0
    const engine = createSoundEngine({
      createContext: () => (created++, ctx)
    })
    engine.setMuted(true)
    engine.play({ type: 'bell' })
    engine.play({ type: 'crack' })
    engine.play({ type: 'tick', urgency: 1 })
    engine.setAmbience(0.8)
    expect(log.oscillators + log.sources).toBe(0)
    expect(created).toBe(0)
  })

  it('drops ambience gain to 0 when muted and stopAll silences it', () => {
    const { ctx, log } = makeFake()
    const engine = createSoundEngine({ createContext: () => ctx })
    engine.setAmbience(0.7)
    expect(log.sources).toBe(1)
    const bedGain = log.gains.find((g) => g.gain.events.some((e) => e.startsWith('target:0.')))
    expect(bedGain).toBeDefined()
    engine.setMuted(true)
    expect(bedGain!.gain.value).toBe(0)
    engine.setMuted(false)
    engine.setAmbience(0.7)
    expect(bedGain!.gain.value).toBeGreaterThan(0)
    engine.stopAll()
    expect(bedGain!.gain.value).toBe(0)
  })

  it('keeps ambience low even at full pressure', () => {
    const { ctx, log } = makeFake()
    const engine = createSoundEngine({ createContext: () => ctx })
    engine.setAmbience(5)
    const bed = log.gains.filter((g) => g.gain.events.some((e) => e.startsWith('target:')))
    expect(bed.length).toBe(1)
    expect(bed[0].gain.value).toBeGreaterThan(0)
    expect(bed[0].gain.value).toBeLessThanOrEqual(0.12)
  })

  it('resumes a suspended context and reuses one context', () => {
    const { ctx, log } = makeFake('suspended')
    let created = 0
    const engine = createSoundEngine({ createContext: () => (created++, ctx) })
    engine.play({ type: 'bell' })
    engine.play({ type: 'bell' })
    expect(created).toBe(1)
    expect(log.resumes).toBeGreaterThan(0)
  })

  it('survives a missing audio backend', () => {
    const engine = createSoundEngine({ createContext: () => null })
    expect(() => engine.play({ type: 'bell' })).not.toThrow()
    expect(() => engine.setAmbience(0.5)).not.toThrow()
    expect(() => engine.stopAll()).not.toThrow()
  })
})
