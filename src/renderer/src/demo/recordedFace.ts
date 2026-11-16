// A face source that replays a recorded session instead of using a camera or the SDK.
// It touches no window.api, no network and no media device: it only emits FaceStatus events
// on a timer, with the same interface the app uses from the live `face`.
import type { FaceSource } from '../face/faceSource'
import type { FaceStatus } from '../face/faceSession'

export interface Recording {
  classes: string[]
  durationMs: number
  // [offsetMs, ...one score per class, in `classes` order]
  expressions: number[][]
  // [offsetMs, value]
  pulse: number[][]
  breathing: number[][]
}

interface Deps {
  recording: Recording
  now?: () => number
  // Schedules fn after ms and returns a cancel function.
  setTimer?: (fn: () => void, ms: number) => () => void
  // Pause after the last sample before the recording starts over.
  loopGapMs?: number
}

type Event = { t: number; kind: 'expr' | 'pulse' | 'breathing'; row: number[] }

const defaultSetTimer = (fn: () => void, ms: number): (() => void) => {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
}

export function createRecordedFace(deps: Deps): FaceSource {
  const { recording } = deps
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? defaultSetTimer
  const cycleMs = recording.durationMs + (deps.loopGapMs ?? 1000)

  const timeline: Event[] = [
    ...recording.expressions.map((row): Event => ({ t: row[0], kind: 'expr', row })),
    ...recording.pulse.map((row): Event => ({ t: row[0], kind: 'pulse', row })),
    ...recording.breathing.map((row): Event => ({ t: row[0], kind: 'breathing', row }))
  ].sort((a, b) => a.t - b.t)

  const listeners = new Set<(status: FaceStatus) => void>()
  const streamListeners = new Set<(stream: MediaStream | null) => void>()
  let cancel: (() => void) | null = null
  let runId = 0

  const base = (): FaceStatus => ({
    running: true,
    faceDetected: true,
    validation: 'Face OK',
    validationCode: 0,
    lastFaceAt: now(),
    error: null,
    talking: false
  })

  const emit = (status: FaceStatus): void => {
    for (const listener of [...listeners]) listener(status)
  }

  const toStatus = (event: Event): FaceStatus => {
    const status = base()
    if (event.kind === 'expr') {
      status.expressions = Object.fromEntries(
        recording.classes.map((name, i) => [name, event.row[i + 1]])
      )
    } else {
      status[event.kind] = { value: event.row[1], confidence: 1, stable: true }
    }
    return status
  }

  function stopTimers(): void {
    runId += 1
    cancel?.()
    cancel = null
  }

  return {
    async start() {
      stopTimers()
      const myRun = runId
      const startedAt = now()
      let index = 0
      let cycle = 0
      emit(base())
      const tick = (): void => {
        if (myRun !== runId) return
        const elapsed = now() - startedAt
        while (timeline.length) {
          const at = cycle * cycleMs + timeline[index].t
          if (at > elapsed) {
            cancel = setTimer(tick, at - elapsed)
            return
          }
          const event = timeline[index]
          index += 1
          if (index === timeline.length) {
            index = 0
            cycle += 1
          }
          emit(toStatus(event))
          if (myRun !== runId) return
        }
      }
      tick()
      return { ok: true }
    },

    async stop() {
      stopTimers()
      return 'stopped'
    },

    onStatus(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },

    onStream(listener) {
      streamListeners.add(listener)
      listener(null)
      return () => void streamListeners.delete(listener)
    }
  }
}
