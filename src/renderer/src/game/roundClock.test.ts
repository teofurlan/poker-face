import { describe, it, expect } from 'vitest'
import { roundClockMs } from './roundClock'

describe('roundClockMs', () => {
  it('measures time from the start of the round, not the wall clock', () => {
    expect(
      roundClockMs(1_794_799_706_200, {
        startMs: 1_794_799_690_000,
        pausedMs: 0,
        pauseStartedAt: null
      })
    ).toBe(16_200)
  })

  it('leaves out time the clock spent paused', () => {
    expect(roundClockMs(30_000, { startMs: 0, pausedMs: 4_000, pauseStartedAt: null })).toBe(26_000)
  })

  it('stops advancing while a pause is in progress', () => {
    const clock = { startMs: 0, pausedMs: 0, pauseStartedAt: 20_000 }
    expect(roundClockMs(20_000, clock)).toBe(20_000)
    expect(roundClockMs(23_000, clock)).toBe(20_000)
  })

  it('never goes below zero', () => {
    expect(roundClockMs(500, { startMs: 1_000, pausedMs: 0, pauseStartedAt: null })).toBe(0)
  })
})
