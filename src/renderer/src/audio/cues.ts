// Pure cue logic: which sounds to play when the observable game state changes.
// No audio, no timers; the engine plays whatever this returns.

export type CueSnapshot =
  | { phase: 'idle' }
  | { phase: 'calibration'; calSecondsLeft: number | null }
  | { phase: 'round'; secondsLeft: number; totalCracks: number; isCracking: boolean }
  | { phase: 'leaderboard' }

export type Cue =
  | { type: 'bell' }
  | { type: 'crack' }
  | { type: 'tick'; urgency: number }
  | { type: 'roundEnd' }
  | { type: 'winner' }

export const TICK_WINDOW_SECONDS = 10

export function cuesBetween(prev: CueSnapshot | null, next: CueSnapshot): Cue[] {
  switch (next.phase) {
    case 'calibration': {
      if (next.calSecondsLeft === null || next.calSecondsLeft <= 0) return []
      const before = prev?.phase === 'calibration' ? prev.calSecondsLeft : null
      return before === next.calSecondsLeft ? [] : [{ type: 'bell' }]
    }
    case 'round': {
      if (prev?.phase !== 'round') return []
      const cues: Cue[] = []
      if (next.totalCracks > prev.totalCracks) cues.push({ type: 'crack' })
      if (next.secondsLeft !== prev.secondsLeft) {
        if (next.secondsLeft <= 0) {
          if (prev.secondsLeft > 0) cues.push({ type: 'roundEnd' })
        } else if (next.secondsLeft <= TICK_WINDOW_SECONDS) {
          cues.push({
            type: 'tick',
            urgency: (TICK_WINDOW_SECONDS + 1 - next.secondsLeft) / TICK_WINDOW_SECONDS
          })
        }
      }
      return cues
    }
    case 'leaderboard':
      return prev?.phase === 'leaderboard' ? [] : [{ type: 'winner' }]
    default:
      return []
  }
}
