import type { CalibrationFailure } from './crackDetector'

// The SDK needs a few seconds after the camera starts before it delivers usable face data,
// so calibration only starts once the face has been valid (code 0) for a moment.
export function createFramingGate(options?: { requiredMs?: number }): {
  update: (validationCode: number, timestampMs: number) => boolean
} {
  const requiredMs = options?.requiredMs ?? 1000
  let validSince: number | null = null
  let open = false
  return {
    update(validationCode, timestampMs) {
      if (open) return true
      if (validationCode !== 0) {
        validSince = null
        return false
      }
      if (validSince === null) validSince = timestampMs
      open = timestampMs - validSince >= requiredMs
      return open
    }
  }
}

export function describeCalibrationFailure(result: CalibrationFailure): string {
  if (result.reason === 'no_samples') {
    return 'No face data arrived from the camera. Check the camera and your connection.'
  }
  const percent = Math.round(result.validRatio * 100)
  return `Only ${percent}% of ${result.sampleCount} face samples were clear (80% needed). Keep your face centered and still.`
}

const VALIDATION: Record<number, string> = {
  0: 'Face OK',
  1: 'No face found',
  2: 'Only one face in frame',
  3: 'Center your face',
  4: 'Move closer or further',
  5: 'Too dark',
  6: 'Too bright',
  7: 'Show your chest',
  10: 'Camera adjusting',
  11: 'Camera too slow',
  12: 'Hold still',
  13: 'Move back a little',
  14: 'Come closer',
  15: 'Move the camera down or sit lower',
  16: 'Move the camera up or sit higher',
  17: 'Look at the camera'
}

export function describeValidation(code: number): string {
  return VALIDATION[code] ?? 'Adjusting'
}
