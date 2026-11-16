// Round-clock time: milliseconds since the round started, leaving out time the clock was paused
// (face out of frame). Crack and speaking timestamps use it, so "time to first crack" and the
// replay timeline line up with the 60 s round clock instead of the wall clock.
export interface RoundClockState {
  startMs: number
  pausedMs: number
  pauseStartedAt: number | null
}

export function roundClockMs(nowMs: number, clock: RoundClockState): number {
  const pausedSoFar =
    clock.pausedMs + (clock.pauseStartedAt !== null ? nowMs - clock.pauseStartedAt : 0)
  return Math.max(0, nowMs - clock.startMs - pausedSoFar)
}
