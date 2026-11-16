import { describe, expect, it } from 'vitest'
import { cuesBetween, type CueSnapshot } from './cues'

const round = (o: Partial<Extract<CueSnapshot, { phase: 'round' }>> = {}): CueSnapshot => ({
  phase: 'round',
  secondsLeft: 60,
  totalCracks: 0,
  isCracking: false,
  ...o
})
const cal = (calSecondsLeft: number | null): CueSnapshot => ({
  phase: 'calibration',
  calSecondsLeft
})
const types = (prev: CueSnapshot | null, next: CueSnapshot): string[] =>
  cuesBetween(prev, next).map((c) => c.type)

describe('cuesBetween: general', () => {
  it('returns nothing for equal snapshots', () => {
    expect(cuesBetween(round(), round())).toEqual([])
    expect(cuesBetween(cal(5), cal(5))).toEqual([])
    expect(cuesBetween(round({ secondsLeft: 5 }), round({ secondsLeft: 5 }))).toEqual([])
  })
  it('returns nothing for idle', () => {
    expect(cuesBetween(null, { phase: 'idle' })).toEqual([])
  })
})

describe('cuesBetween: calibration', () => {
  it('rings a bell for each countdown second', () => {
    expect(types(cal(null), cal(8))).toEqual(['bell'])
    expect(types(cal(8), cal(7))).toEqual(['bell'])
    expect(types(cal(1), cal(0))).toEqual([])
  })
  it('is silent while framing', () => {
    expect(types(cal(null), cal(null))).toEqual([])
    expect(types(cal(3), cal(null))).toEqual([])
  })
  it('rings for the first second when there is no previous snapshot', () => {
    expect(types(null, cal(8))).toEqual(['bell'])
  })
})

describe('cuesBetween: crack', () => {
  it('plays once when totalCracks increases', () => {
    expect(types(round(), round({ totalCracks: 1, isCracking: true }))).toEqual(['crack'])
  })
  it('does not repeat while the same crack continues', () => {
    const a = round({ totalCracks: 1, isCracking: true })
    expect(cuesBetween(a, round({ totalCracks: 1, isCracking: true }))).toEqual([])
    expect(cuesBetween(a, round({ totalCracks: 1, isCracking: false }))).toEqual([])
  })
  it('plays once even if the count jumps by more than one', () => {
    expect(types(round(), round({ totalCracks: 2 }))).toEqual(['crack'])
  })
  it('plays again for a second crack', () => {
    expect(types(round({ totalCracks: 1 }), round({ totalCracks: 2 }))).toEqual(['crack'])
  })
  it('does not play when there is no previous round snapshot', () => {
    expect(types(null, round({ totalCracks: 1 }))).toEqual([])
  })
})

describe('cuesBetween: tick', () => {
  it('has no tick at 11 s', () => {
    expect(types(round({ secondsLeft: 12 }), round({ secondsLeft: 11 }))).toEqual([])
  })
  it('ticks at every second from 10 to 1', () => {
    for (let s = 10; s >= 1; s--) {
      expect(types(round({ secondsLeft: s + 1 }), round({ secondsLeft: s }))).toEqual(['tick'])
    }
  })
  it('urgency rises as time runs out, within (0, 1]', () => {
    const u = (s: number): number => {
      const c = cuesBetween(round({ secondsLeft: s + 1 }), round({ secondsLeft: s }))[0]
      return c.type === 'tick' ? c.urgency : -1
    }
    for (let s = 10; s > 1; s--) expect(u(s - 1)).toBeGreaterThan(u(s))
    expect(u(10)).toBeGreaterThan(0)
    expect(u(1)).toBe(1)
  })
  it('does not tick at 0, it ends the round once', () => {
    expect(types(round({ secondsLeft: 1 }), round({ secondsLeft: 0 }))).toEqual(['roundEnd'])
    expect(types(round({ secondsLeft: 0 }), round({ secondsLeft: 0 }))).toEqual([])
  })
})

describe('cuesBetween: winner', () => {
  it('plays once on entering the leaderboard', () => {
    const lb: CueSnapshot = { phase: 'leaderboard' }
    expect(types(round({ secondsLeft: 0 }), lb)).toEqual(['winner'])
    expect(types(null, lb)).toEqual(['winner'])
    expect(types(lb, lb)).toEqual([])
  })
})
