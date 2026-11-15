import { describe, it, expect } from 'vitest'
import { createFramingGate, describeCalibrationFailure, describeValidation } from './calibration'
import { createBaselineCalibrator, type ExpressionScores } from './crackDetector'

const scores: ExpressionScores = {
  ANGRY: 0,
  CONTEMPT: 0,
  DISGUST: 0,
  FEAR: 0,
  HAPPY: 0,
  NEUTRAL: 80,
  SAD: 20,
  SURPRISE: 0
}

describe('createFramingGate', () => {
  it('opens only after the face stays valid for the required time', () => {
    const gate = createFramingGate({ requiredMs: 1000 })
    expect(gate.update(0, 0)).toBe(false)
    expect(gate.update(0, 999)).toBe(false)
    expect(gate.update(0, 1000)).toBe(true)
  })

  it('restarts the wait when the face stops being valid', () => {
    const gate = createFramingGate({ requiredMs: 1000 })
    gate.update(0, 0)
    expect(gate.update(16, 800)).toBe(false)
    expect(gate.update(0, 900)).toBe(false)
    expect(gate.update(0, 1800)).toBe(false)
    expect(gate.update(0, 1900)).toBe(true)
  })

  it('stays open once opened, even if the face is lost later', () => {
    const gate = createFramingGate({ requiredMs: 1000 })
    gate.update(0, 0)
    gate.update(0, 1000)
    expect(gate.update(1, 1100)).toBe(true)
  })
})

describe('createBaselineCalibrator counts', () => {
  it('reports received and valid sample counts on failure', () => {
    const cal = createBaselineCalibrator({ minValidRatio: 0.8 })
    cal.addSample(scores, 0)
    cal.addSample(scores, 16)
    cal.addSample(scores, 16)
    cal.addSample(scores, 0)
    const result = cal.finish()
    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_valid_samples',
      validRatio: 0.5,
      sampleCount: 4,
      validCount: 2
    })
  })

  it('reports zero samples when nothing arrived', () => {
    const result = createBaselineCalibrator().finish()
    expect(result).toEqual({
      ok: false,
      reason: 'no_samples',
      validRatio: 0,
      sampleCount: 0,
      validCount: 0
    })
  })
})

describe('describeCalibrationFailure', () => {
  it('explains that no face data arrived', () => {
    expect(
      describeCalibrationFailure({
        ok: false,
        reason: 'no_samples',
        validRatio: 0,
        sampleCount: 0,
        validCount: 0
      })
    ).toBe('No face data arrived from the camera. Check the camera and your connection.')
  })

  it('states how many samples were clear against the 80% needed', () => {
    expect(
      describeCalibrationFailure({
        ok: false,
        reason: 'insufficient_valid_samples',
        validRatio: 0.425,
        sampleCount: 200,
        validCount: 85
      })
    ).toBe(
      'Only 43% of 200 face samples were clear (80% needed). Keep your face centered and still.'
    )
  })
})

describe('describeValidation', () => {
  it('maps SDK validation codes to player hints', () => {
    expect(describeValidation(0)).toBe('Face OK')
    expect(describeValidation(1)).toBe('No face found')
    expect(describeValidation(16)).toBe('Move the camera up or sit higher')
  })

  it('falls back for unknown codes', () => {
    expect(describeValidation(99)).toBe('Adjusting')
  })
})
