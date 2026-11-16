// Web Audio synthesis for the Fight Night sound character. No files, no dependencies.
// Everything is generated here; levels are deliberately gentle (party room, mixed audience).
import type { Cue } from './cues'

export type AudioContextLike = Pick<
  AudioContext,
  | 'state'
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'createOscillator'
  | 'createBufferSource'
  | 'createGain'
  | 'createBiquadFilter'
  | 'createBuffer'
  | 'resume'
>

export interface SoundEngine {
  play(cue: Cue): void
  /** Arena-hush level 0..1 (from the pressure meter). Room mood only. */
  setAmbience(level: number): void
  stopAmbience(): void
  stopAll(): void
  setMuted(muted: boolean): void
  /** Call from a user gesture so a suspended context can start. */
  unlock(): void
}

interface EngineOptions {
  createContext: () => AudioContextLike | null
}

const AMBIENCE_FLOOR = 0.025
const AMBIENCE_SPAN = 0.075 // peak 0.10: a murmur, never an alarm

export function createSoundEngine({ createContext }: EngineOptions): SoundEngine {
  let ctx: AudioContextLike | null = null
  let muted = false
  let ambienceLevel: number | null = null
  let bed: { source: AudioBufferSourceNode; gain: GainNode } | null = null
  const live = new Set<OscillatorNode | AudioBufferSourceNode>()

  const ensure = (): AudioContextLike | null => {
    if (!ctx) {
      try {
        ctx = createContext()
      } catch {
        ctx = null
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx
  }

  const track = (node: OscillatorNode | AudioBufferSourceNode): void => {
    live.add(node)
    node.onended = () => live.delete(node)
  }

  const tone = (
    c: AudioContextLike,
    opts: {
      type: OscillatorType
      freq: number
      freqEnd?: number
      at: number
      dur: number
      peak: number
      attack?: number
      dest?: AudioNode
    }
  ): void => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    const attack = opts.attack ?? 0.004
    osc.type = opts.type
    osc.frequency.setValueAtTime(opts.freq, opts.at)
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, opts.at + opts.dur)
    gain.gain.setValueAtTime(0.0001, opts.at)
    gain.gain.linearRampToValueAtTime(opts.peak, opts.at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur)
    osc.connect(gain)
    gain.connect(opts.dest ?? c.destination)
    track(osc)
    osc.start(opts.at)
    osc.stop(opts.at + opts.dur + 0.05)
  }

  const noiseBuffer = (c: AudioContextLike, seconds: number): AudioBuffer => {
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // Struck bell: inharmonic partials with longer decay on the low ones.
  const bell = (c: AudioContextLike, at: number, base: number, level: number): void => {
    const partials: Array<[number, number, number]> = [
      [1, 1, 1.4],
      [2.76, 0.55, 0.9],
      [5.4, 0.3, 0.55],
      [8.93, 0.15, 0.3]
    ]
    for (const [ratio, amp, dur] of partials) {
      tone(c, { type: 'sine', freq: base * ratio, at, dur, peak: level * amp, attack: 0.003 })
    }
  }

  const crack = (c: AudioContextLike, at: number): void => {
    // Heavy thud: low sine with a fast pitch drop.
    tone(c, { type: 'sine', freq: 150, freqEnd: 42, at, dur: 0.32, peak: 0.45, attack: 0.005 })
    // Camera-flash pop: short high-passed noise burst.
    const src = c.createBufferSource()
    const filter = c.createBiquadFilter()
    const gain = c.createGain()
    src.buffer = noiseBuffer(c, 0.12)
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(2200, at)
    gain.gain.setValueAtTime(0.0001, at + 0.02)
    gain.gain.linearRampToValueAtTime(0.16, at + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)
    track(src)
    src.start(at + 0.02)
    src.stop(at + 0.14)
  }

  const tick = (c: AudioContextLike, at: number, urgency: number): void => {
    const u = Math.min(1, Math.max(0, urgency))
    tone(c, {
      type: 'square',
      freq: 800 + 700 * u,
      freqEnd: 500 + 400 * u,
      at,
      dur: 0.035,
      peak: 0.04 + 0.1 * u,
      attack: 0.002
    })
  }

  const winner = (c: AudioContextLike, at: number): void => {
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, at)
    filter.connect(c.destination)
    const notes = [261.63, 329.63, 392, 523.25] // C major arpeggio rising into a chord
    notes.forEach((f, i) => {
      const start = at + i * 0.1
      tone(c, {
        type: 'sawtooth',
        freq: f,
        at: start,
        dur: 1.1 - i * 0.1,
        peak: 0.07,
        attack: 0.03,
        dest: filter
      })
      tone(c, {
        type: 'sawtooth',
        freq: f * 1.004,
        at: start,
        dur: 1.1 - i * 0.1,
        peak: 0.05,
        attack: 0.03,
        dest: filter
      })
    })
  }

  const applyAmbience = (): void => {
    if (ambienceLevel === null) return
    if (muted) {
      if (bed) bed.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.05)
      return
    }
    const c = ensure()
    if (!c) return
    if (!bed) {
      const source = c.createBufferSource()
      const filter = c.createBiquadFilter()
      const gain = c.createGain()
      source.buffer = noiseBuffer(c, 2)
      source.loop = true
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(520, c.currentTime)
      gain.gain.setValueAtTime(0, c.currentTime)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(c.destination)
      source.start()
      bed = { source, gain }
    }
    const level = Math.min(1, Math.max(0, Number.isFinite(ambienceLevel) ? ambienceLevel : 0))
    bed.gain.gain.setTargetAtTime(AMBIENCE_FLOOR + AMBIENCE_SPAN * level, c.currentTime, 0.8)
  }

  const dropBed = (): void => {
    if (!bed) return
    try {
      bed.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.02)
      bed.source.stop((ctx?.currentTime ?? 0) + 0.15)
      bed.source.disconnect()
    } catch {
      // already stopped
    }
    bed = null
  }

  return {
    play(cue) {
      if (muted) return
      const c = ensure()
      if (!c) return
      const at = c.currentTime + 0.01
      switch (cue.type) {
        case 'bell':
          bell(c, at, 660, 0.14)
          break
        case 'crack':
          crack(c, at)
          break
        case 'tick':
          tick(c, at, cue.urgency)
          break
        case 'roundEnd':
          bell(c, at, 440, 0.22)
          bell(c, at + 0.45, 440, 0.18)
          break
        case 'winner':
          winner(c, at)
          break
      }
    },
    setAmbience(level) {
      ambienceLevel = level
      applyAmbience()
    },
    stopAmbience() {
      ambienceLevel = null
      dropBed()
    },
    stopAll() {
      ambienceLevel = null
      dropBed()
      for (const node of live) {
        try {
          node.stop()
        } catch {
          // already stopped
        }
      }
      live.clear()
    },
    setMuted(next) {
      muted = next
      if (muted) {
        if (bed) bed.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.05)
        for (const node of live) {
          try {
            node.stop()
          } catch {
            // already stopped
          }
        }
        live.clear()
      } else {
        applyAmbience()
      }
    },
    unlock() {
      if (!muted) ensure()
    }
  }
}
