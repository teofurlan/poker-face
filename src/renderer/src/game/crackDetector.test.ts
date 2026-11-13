import { describe, it, expect } from 'vitest'
import {
  calculateTotalVariation,
  createBaselineCalibrator,
  createCrackDetector,
  type ExpressionScores
} from './crackDetector'

const neutralBaseline: ExpressionScores = {
  ANGRY: 0,
  CONTEMPT: 0,
  DISGUST: 0,
  FEAR: 0,
  HAPPY: 0,
  NEUTRAL: 80,
  SAD: 20,
  SURPRISE: 0
}

describe('calculateTotalVariation', () => {
  it('returns 0 when sample equals baseline', () => {
    const tv = calculateTotalVariation(neutralBaseline, neutralBaseline)
    expect(tv).toBe(0)
  })

  it('calculates half L1 distance accurately (TVD)', () => {
    // If HAPPY rises by 50 and NEUTRAL drops by 50:
    // L1 = |50-0| + |30-80| = 50 + 50 = 100. Half L1 = 50.
    const smile: ExpressionScores = {
      ...neutralBaseline,
      HAPPY: 50,
      NEUTRAL: 30
    }
    const tv = calculateTotalVariation(smile, neutralBaseline)
    expect(tv).toBe(50)
  })
})

describe('createBaselineCalibrator', () => {
  it('computes average baseline from valid samples', () => {
    const calibrator = createBaselineCalibrator({ durationMs: 8000, minValidRatio: 0.8 })

    // Add 10 samples, all valid (validation code 0)
    for (let i = 0; i < 10; i++) {
      calibrator.addSample(
        {
          ANGRY: 10,
          CONTEMPT: 0,
          DISGUST: 0,
          FEAR: 0,
          HAPPY: 0,
          NEUTRAL: 70,
          SAD: 20,
          SURPRISE: 0
        },
        0
      )
    }

    const result = calibrator.finish()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.baseline.ANGRY).toBe(10)
      expect(result.baseline.NEUTRAL).toBe(70)
      expect(result.baseline.SAD).toBe(20)
    }
  })

  it('fails if valid samples ratio is below threshold', () => {
    const calibrator = createBaselineCalibrator({ durationMs: 8000, minValidRatio: 0.8 })

    // 5 valid, 5 invalid (code 1 = No face found)
    for (let i = 0; i < 5; i++) {
      calibrator.addSample(neutralBaseline, 0)
    }
    for (let i = 0; i < 5; i++) {
      calibrator.addSample(neutralBaseline, 1)
    }

    const result = calibrator.finish()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('insufficient_valid_samples')
      expect(result.validRatio).toBe(0.5)
    }
  })
})

describe('createCrackDetector', () => {
  it('detects a crack when TVD >= 40', () => {
    const detector = createCrackDetector({
      baseline: neutralBaseline,
      startThreshold: 40,
      endThreshold: 25,
      hysteresisMs: 500,
      cooldownMs: 1000
    })

    // Resting sample (TVD = 0)
    let state = detector.processSample(neutralBaseline, 1000)
    expect(state.isCracking).toBe(false)
    expect(state.totalCracks).toBe(0)

    // Smiling sample (TVD = 50 >= 40) -> crack starts!
    const smile: ExpressionScores = {
      ...neutralBaseline,
      HAPPY: 50,
      NEUTRAL: 30
    }
    state = detector.processSample(smile, 2000)
    expect(state.isCracking).toBe(true)
    expect(state.totalCracks).toBe(1)
    expect(state.firstCrackMs).toBe(2000)
  })

  it('sustained laughter counts as exactly one crack until hysteresis elapses', () => {
    const detector = createCrackDetector({
      baseline: neutralBaseline,
      startThreshold: 40,
      endThreshold: 25,
      hysteresisMs: 500,
      cooldownMs: 1000
    })

    const smile: ExpressionScores = { ...neutralBaseline, HAPPY: 50, NEUTRAL: 30 }

    // Start crack at t=1000
    detector.processSample(smile, 1000)
    // Continues smiling at t=1500, 2000, 2500
    detector.processSample(smile, 1500)
    detector.processSample(smile, 2000)
    const state = detector.processSample(smile, 2500)

    expect(state.isCracking).toBe(true)
    expect(state.totalCracks).toBe(1)

    // Drops below 25 at t=3000
    detector.processSample(neutralBaseline, 3000)
    // At t=3200 (200ms < 500ms hysteresis), still cracking
    let s2 = detector.processSample(neutralBaseline, 3200)
    expect(s2.isCracking).toBe(true)

    // At t=3500 (500ms hysteresis elapsed), crack finishes and cooldown starts!
    s2 = detector.processSample(neutralBaseline, 3500)
    expect(s2.isCracking).toBe(false)
    expect(s2.inCooldown).toBe(true)
    expect(s2.totalCracks).toBe(1)
    expect(s2.cracks[0]).toEqual({
      startMs: 1000,
      endMs: 3500,
      peakVariation: 50
    })
  })

  it('enforces 1 second cooldown after crack finishes before allowing another', () => {
    const detector = createCrackDetector({
      baseline: neutralBaseline,
      startThreshold: 40,
      endThreshold: 25,
      hysteresisMs: 500,
      cooldownMs: 1000
    })

    const smile: ExpressionScores = { ...neutralBaseline, HAPPY: 50, NEUTRAL: 30 }

    // Crack from 1000 to 2000, ends at 2500
    detector.processSample(smile, 1000)
    detector.processSample(neutralBaseline, 2000)
    detector.processSample(neutralBaseline, 2500) // ended at 2500

    // During cooldown (at 3000, which is 500ms into 1000ms cooldown)
    let state = detector.processSample(smile, 3000)
    expect(state.inCooldown).toBe(true)
    expect(state.isCracking).toBe(false)
    expect(state.totalCracks).toBe(1) // Ignored during cooldown

    // After cooldown (at 3600, which is > 1000ms after 2500)
    state = detector.processSample(smile, 3600)
    expect(state.inCooldown).toBe(false)
    expect(state.isCracking).toBe(true)
    expect(state.totalCracks).toBe(2)
  })
})
