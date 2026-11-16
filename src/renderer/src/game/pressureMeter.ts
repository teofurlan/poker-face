export interface VitalSample {
  value: number
  confidence: number
  stable: boolean
}

export type PressureStatus = 'settling' | 'active' | 'holding'
export type PressureTrend = 'rising' | 'steady' | 'dropping'

export interface PressureState {
  status: PressureStatus
  pulseBpm: number | null
  breathingRate: number | null
  pressureScore: number
  trend: PressureTrend
}

export interface PressureMeterOptions {
  settleDurationMs?: number
}

export function createPressureMeter(options?: PressureMeterOptions): {
  addPulse: (sample: VitalSample, timestampMs: number) => void
  addBreathing: (sample: VitalSample, timestampMs: number) => void
  setValidationStatus: (code: number, timestampMs: number) => void
  tick: (timestampMs: number) => void
  getState: () => PressureState
  reset: () => void
} {
  const settleDurationMs = options?.settleDurationMs ?? 20000

  let latestPulse: VitalSample | null = null
  let latestBreathing: VitalSample | null = null
  let baselinePulse: number | null = null
  let baselineBreathing: number | null = null

  let chestMissing = false
  let currentTimestamp = 0
  let pressureScore = 0
  let prevScore = 0
  let trend: PressureTrend = 'steady'

  function computePressureScore(): number {
    if (!latestPulse || !latestBreathing || baselinePulse === null || baselineBreathing === null) {
      return 0
    }

    // Baseline difference
    const pulseDelta = Math.max(0, latestPulse.value - baselinePulse)
    const breathingDelta = Math.max(0, latestBreathing.value - baselineBreathing)

    // Pulse: +30 bpm delta reaches ~60 points
    const pulseContrib = (pulseDelta / 30) * 60
    // Breathing: +10 breaths/min reaches ~40 points
    const breathingContrib = (breathingDelta / 10) * 40

    const raw = Math.round(pulseContrib + breathingContrib)
    return Math.min(100, Math.max(0, raw))
  }

  function updateState(): void {
    if (chestMissing && (latestPulse || latestBreathing)) {
      // Hold last score and state
      return
    }

    const isSettled = currentTimestamp >= settleDurationMs
    if (isSettled && latestPulse && latestBreathing) {
      prevScore = pressureScore
      pressureScore = computePressureScore()

      if (pressureScore > prevScore + 3) {
        trend = 'rising'
      } else if (pressureScore < prevScore - 3) {
        trend = 'dropping'
      } else {
        trend = 'steady'
      }
    }
  }

  function getState(): PressureState {
    const isSettled = currentTimestamp >= settleDurationMs

    let status: PressureStatus
    if (chestMissing) {
      status = 'holding'
    } else if (isSettled && latestPulse !== null && latestBreathing !== null) {
      status = 'active'
    } else {
      status = 'settling'
    }

    return {
      status,
      pulseBpm: latestPulse ? Math.round(latestPulse.value) : null,
      breathingRate: latestBreathing ? Math.round(latestBreathing.value) : null,
      pressureScore,
      trend
    }
  }

  function addPulse(sample: VitalSample, timestampMs: number): void {
    currentTimestamp = timestampMs
    latestPulse = sample
    if (baselinePulse === null) {
      baselinePulse = sample.value
    }
    updateState()
  }

  function addBreathing(sample: VitalSample, timestampMs: number): void {
    currentTimestamp = timestampMs
    latestBreathing = sample
    if (baselineBreathing === null) {
      baselineBreathing = sample.value
    }
    updateState()
  }

  function setValidationStatus(code: number, timestampMs: number): void {
    currentTimestamp = timestampMs
    // code 7 = kChestNotVisible
    chestMissing = code === 7
    updateState()
  }

  function tick(timestampMs: number): void {
    currentTimestamp = timestampMs
    updateState()
  }

  function reset(): void {
    latestPulse = null
    latestBreathing = null
    baselinePulse = null
    baselineBreathing = null
    chestMissing = false
    currentTimestamp = 0
    pressureScore = 0
    prevScore = 0
    trend = 'steady'
  }

  return {
    addPulse,
    addBreathing,
    setValidationStatus,
    tick,
    getState,
    reset
  }
}
