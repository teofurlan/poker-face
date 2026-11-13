export const EXPRESSIONS = [
  'ANGRY',
  'CONTEMPT',
  'DISGUST',
  'FEAR',
  'HAPPY',
  'NEUTRAL',
  'SAD',
  'SURPRISE'
] as const

export type ExpressionName = (typeof EXPRESSIONS)[number]
export type ExpressionScores = Record<ExpressionName, number>

export interface CrackEvent {
  startMs: number
  endMs: number
  peakVariation: number
}

export interface CrackDetectorState {
  isCracking: boolean
  inCooldown: boolean
  currentVariation: number
  totalCracks: number
  firstCrackMs: number | null
  cracks: CrackEvent[]
}

export interface CalibratorOptions {
  durationMs?: number
  minValidRatio?: number
}

export interface CalibrationSuccess {
  ok: true
  baseline: ExpressionScores
  validRatio: number
}

export interface CalibrationFailure {
  ok: false
  reason: 'insufficient_valid_samples' | 'no_samples'
  validRatio: number
}

export type CalibrationResult = CalibrationSuccess | CalibrationFailure

export interface CrackDetectorOptions {
  baseline: ExpressionScores
  startThreshold?: number
  endThreshold?: number
  hysteresisMs?: number
  cooldownMs?: number
}

/**
 * Calculates Total Variation Distance (TVD) between sample and baseline.
 * TVD = 0.5 * sum(|sample_i - baseline_i|) across all 8 expression classes.
 * Range: 0 to 100 if scores sum to 100.
 */
export function calculateTotalVariation(
  sample: ExpressionScores,
  baseline: ExpressionScores
): number {
  let sumAbsDiff = 0
  for (const expr of EXPRESSIONS) {
    const s = sample[expr] ?? 0
    const b = baseline[expr] ?? 0
    sumAbsDiff += Math.abs(s - b)
  }
  return sumAbsDiff / 2
}

export function createBaselineCalibrator(options?: CalibratorOptions): {
  addSample: (scores: ExpressionScores, validationCode: number) => void
  finish: () => CalibrationResult
  sampleCount: () => number
} {
  const minValidRatio = options?.minValidRatio ?? 0.8
  const validSamples: ExpressionScores[] = []
  let totalSamples = 0

  return {
    addSample(scores: ExpressionScores, validationCode: number): void {
      totalSamples += 1
      if (validationCode === 0) {
        validSamples.push({ ...scores })
      }
    },
    sampleCount(): number {
      return totalSamples
    },
    finish(): CalibrationResult {
      if (totalSamples === 0) {
        return { ok: false, reason: 'no_samples', validRatio: 0 }
      }
      const validRatio = validSamples.length / totalSamples
      if (validRatio < minValidRatio) {
        return { ok: false, reason: 'insufficient_valid_samples', validRatio }
      }

      const baseline = {} as ExpressionScores
      for (const expr of EXPRESSIONS) {
        const sum = validSamples.reduce((acc, s) => acc + (s[expr] ?? 0), 0)
        baseline[expr] = sum / validSamples.length
      }

      return { ok: true, baseline, validRatio }
    }
  }
}

export function createCrackDetector(options: CrackDetectorOptions): {
  processSample: (sample: ExpressionScores, timestampMs: number) => CrackDetectorState
  getState: () => CrackDetectorState
  reset: () => void
} {
  const {
    baseline,
    startThreshold = 40,
    endThreshold = 25,
    hysteresisMs = 500,
    cooldownMs = 1000
  } = options

  let isCracking = false
  let inCooldown = false
  let currentVariation = 0
  let firstCrackMs: number | null = null
  const cracks: CrackEvent[] = []

  let currentCrackStartMs = 0
  let peakVariation = 0
  let belowThresholdSinceMs: number | null = null
  let cooldownUntilMs = 0

  function getState(): CrackDetectorState {
    return {
      isCracking,
      inCooldown,
      currentVariation,
      totalCracks: cracks.length + (isCracking ? 1 : 0),
      firstCrackMs,
      cracks: [...cracks]
    }
  }

  function processSample(sample: ExpressionScores, timestampMs: number): CrackDetectorState {
    currentVariation = calculateTotalVariation(sample, baseline)

    // Check cooldown expiry
    if (inCooldown && timestampMs >= cooldownUntilMs) {
      inCooldown = false
    }

    if (!isCracking) {
      if (!inCooldown && currentVariation >= startThreshold) {
        // Crack begins!
        isCracking = true
        currentCrackStartMs = timestampMs
        peakVariation = currentVariation
        belowThresholdSinceMs = null
        if (firstCrackMs === null) {
          firstCrackMs = timestampMs
        }
      }
    } else {
      // Currently cracking
      if (currentVariation > peakVariation) {
        peakVariation = currentVariation
      }

      if (currentVariation < endThreshold) {
        if (belowThresholdSinceMs === null) {
          belowThresholdSinceMs = timestampMs
        } else if (timestampMs - belowThresholdSinceMs >= hysteresisMs) {
          // Crack ended!
          cracks.push({
            startMs: currentCrackStartMs,
            endMs: timestampMs,
            peakVariation
          })
          isCracking = false
          belowThresholdSinceMs = null
          inCooldown = true
          cooldownUntilMs = timestampMs + cooldownMs
        }
      } else {
        // Variation rose back above endThreshold, reset hysteresis timer
        belowThresholdSinceMs = null
      }
    }

    return getState()
  }

  function reset(): void {
    isCracking = false
    inCooldown = false
    currentVariation = 0
    firstCrackMs = null
    cracks.length = 0
    currentCrackStartMs = 0
    peakVariation = 0
    belowThresholdSinceMs = null
    cooldownUntilMs = 0
  }

  return {
    processSample,
    getState,
    reset
  }
}
