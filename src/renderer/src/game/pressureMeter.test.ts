import { describe, it, expect } from 'vitest'
import { createPressureMeter } from './pressureMeter'

describe('createPressureMeter', () => {
  it('starts in settling state during initial period or before vitals arrive', () => {
    const meter = createPressureMeter({ settleDurationMs: 20000 })

    const state = meter.getState()
    expect(state.status).toBe('settling')
    expect(state.pulseBpm).toBeNull()
    expect(state.breathingRate).toBeNull()
    expect(state.pressureScore).toBe(0)
  })

  it('transitions to active once vitals arrive after settle time', () => {
    const meter = createPressureMeter({ settleDurationMs: 20000 })

    // Feed samples during settle period (t = 5000)
    meter.addPulse({ value: 70, confidence: 90, stable: true }, 5000)
    meter.addBreathing({ value: 14, confidence: 85, stable: true }, 5000)

    let state = meter.getState()
    expect(state.status).toBe('settling')
    expect(state.pulseBpm).toBe(70)
    expect(state.breathingRate).toBe(14)

    // At t = 21000 (> 20000 settle duration)
    meter.tick(21000)
    state = meter.getState()
    expect(state.status).toBe('active')
  })

  it('calculates pressure score (0-100) reflecting elevated vitals', () => {
    const meter = createPressureMeter({ settleDurationMs: 20000 })

    // Settle baseline at 70 bpm and 12 bpm breathing
    meter.addPulse({ value: 70, confidence: 90, stable: true }, 10000)
    meter.addBreathing({ value: 12, confidence: 90, stable: true }, 10000)
    meter.tick(21000)

    // Now pulse and breathing rise due to tension/laughter pressure
    meter.addPulse({ value: 95, confidence: 90, stable: true }, 25000) // +25 bpm
    meter.addBreathing({ value: 20, confidence: 90, stable: true }, 25000) // +8 breaths/min

    const state = meter.getState()
    expect(state.status).toBe('active')
    expect(state.pressureScore).toBeGreaterThan(40)
    expect(state.pressureScore).toBeLessThanOrEqual(100)
    expect(state.trend).toBe('rising')
  })

  it('gracefully holds last known vitals and pressure if chest is not visible (validation code 7)', () => {
    const meter = createPressureMeter({ settleDurationMs: 20000 })

    meter.addPulse({ value: 75, confidence: 90, stable: true }, 10000)
    meter.addBreathing({ value: 14, confidence: 90, stable: true }, 10000)
    meter.tick(21000)

    const beforeState = meter.getState()
    expect(beforeState.status).toBe('active')

    // Validation event: Show your chest (code 7)
    meter.setValidationStatus(7, 22000)
    const heldState = meter.getState()

    // Must NOT crash or drop to 0, stays in 'holding' state
    expect(heldState.status).toBe('holding')
    expect(heldState.pulseBpm).toBe(75)
    expect(heldState.breathingRate).toBe(14)
    expect(heldState.pressureScore).toBe(beforeState.pressureScore)

    // When chest comes back into frame (code 0 = Face OK)
    meter.setValidationStatus(0, 24000)
    const recoveredState = meter.getState()
    expect(recoveredState.status).toBe('active')
  })
})
