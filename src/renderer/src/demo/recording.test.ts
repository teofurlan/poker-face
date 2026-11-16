import { describe, expect, it } from 'vitest'
import { createBaselineCalibrator, createCrackDetector } from '../game/crackDetector'
import type { ExpressionScores } from '../game/crackDetector'
import { createFramingGate } from '../game/calibration'
import { createRecordedFace, type Recording } from './recordedFace'
import recordingJson from './recording.json'

const recording = recordingJson as unknown as Recording & { source: string }

// Drives the bundled recording through the same framing gate, calibrator and crack detector
// the game uses, on a virtual clock: 1 s framing gate, 8 s calibration, then a 60 s round.
function playDemoRound(): { calibrated: boolean; cracks: number; firstCrackMs: number | null } {
  let time = 0
  const timers: { at: number; fn: () => void; live: boolean }[] = []
  const source = createRecordedFace({
    recording,
    now: () => time,
    setTimer: (fn, ms) => {
      const t = { at: time + ms, fn, live: true }
      timers.push(t)
      return () => void (t.live = false)
    }
  })
  const gate = createFramingGate({ requiredMs: 1000 })
  const calibrator = createBaselineCalibrator({ minValidRatio: 0.8 })
  let calibStart: number | null = null
  let roundStart: number | null = null
  const round: { detector: ReturnType<typeof createCrackDetector> | null } = { detector: null }
  let calibrated = false

  source.onStatus((s) => {
    if (roundStart !== null && round.detector) {
      if (s.expressions)
        round.detector.processSample(s.expressions as ExpressionScores, time - roundStart)
      return
    }
    if (calibStart === null) {
      if (gate.update(s.validationCode, time)) calibStart = time
      return
    }
    if (s.expressions) calibrator.addSample(s.expressions as ExpressionScores, s.validationCode)
    if (time - calibStart >= 8000) {
      const result = calibrator.finish()
      if (result.ok) {
        calibrated = true
        round.detector = createCrackDetector({ baseline: result.baseline })
        roundStart = time
      }
    }
  })

  void source.start('x')
  for (;;) {
    const next = timers.filter((t) => t.live).sort((a, b) => a.at - b.at)[0]
    if (!next || (roundStart !== null && next.at - roundStart > 60000)) break
    next.live = false
    time = next.at
    next.fn()
  }
  const state = round.detector?.getState()
  return { calibrated, cracks: state?.totalCracks ?? 0, firstCrackMs: state?.firstCrackMs ?? null }
}

describe('bundled recording', () => {
  it('has the expected shape and no cue labels', () => {
    expect(recording.classes).toHaveLength(8)
    expect(recording.expressions.length).toBeGreaterThan(2000)
    expect(recording.expressions.every((r) => r.length === 9)).toBe(true)
    expect(JSON.stringify(recordingJson)).not.toContain('cue')
    expect(recording.durationMs).toBeGreaterThan(70000)
  })

  it('calibrates, then produces cracks in a 60 s round', () => {
    const result = playDemoRound()
    console.log('DEMO RESULT', JSON.stringify(result))
    expect(result.calibrated).toBe(true)
    expect(result.cracks).toBeGreaterThan(0)
  })
})
