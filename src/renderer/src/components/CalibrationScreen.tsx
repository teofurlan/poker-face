import { useEffect, useRef, useState } from 'react'
import { createBaselineCalibrator, type ExpressionScores } from '../game/crackDetector'

interface CalibrationScreenProps {
  playerName: string
  onCalibrated: (baseline: ExpressionScores) => void
  onCancel: () => void
  // Testing/hook injection for samples
  registerSampleReceiver?: (
    fn: (scores: ExpressionScores, validationCode: number) => void
  ) => () => void
}

export function CalibrationScreen({
  playerName,
  onCalibrated,
  onCancel,
  registerSampleReceiver
}: CalibrationScreenProps): React.JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(8)
  const [retriesLeft, setRetriesLeft] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [validationHint, setValidationHint] = useState<string>('Hold still and face the camera')

  const calibratorRef = useRef(createBaselineCalibrator({ durationMs: 8000, minValidRatio: 0.8 }))

  useEffect(() => {
    calibratorRef.current = createBaselineCalibrator({ durationMs: 8000, minValidRatio: 0.8 })

    // Interval countdown
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          const result = calibratorRef.current.finish()
          if (result.ok) {
            onCalibrated(result.baseline)
          } else {
            setError('Could not settle a clear baseline. Keep your face centered and still.')
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Hook sample receiver if supplied
    const unregister = registerSampleReceiver?.((scores, code) => {
      calibratorRef.current.addSample(scores, code)
      if (code === 0) setValidationHint('Face OK — learning resting face')
      else if (code === 1) setValidationHint('No face detected — move into frame')
      else setValidationHint('Hold still and look at the camera')
    })

    return () => {
      clearInterval(timer)
      unregister?.()
    }
  }, [retriesLeft, onCalibrated, registerSampleReceiver])

  const handleRetry = (): void => {
    if (retriesLeft > 0) {
      setSecondsLeft(8)
      setError(null)
      setRetriesLeft((r) => r - 1)
    } else {
      onCancel()
    }
  }

  return (
    <div className="panel calibration-panel">
      <p className="muted">Calibrating Hot Seat: {playerName}</p>
      <h1>{error ? 'Calibration Failed' : `Calibrating: ${secondsLeft}s`}</h1>

      {!error ? (
        <>
          <div className="countdown-ring">{secondsLeft}</div>
          <p className="validation">{validationHint}</p>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${((8 - secondsLeft) / 8) * 100}%` }}
            />
          </div>
          <p className="hint">Challengers, stay quiet while we learn the resting face.</p>
        </>
      ) : (
        <>
          <p className="error">{error}</p>
          <div className="calibration-actions">
            {retriesLeft > 0 ? (
              <button type="button" className="primary-btn" onClick={handleRetry}>
                Try Calibration Again ({retriesLeft} retries left)
              </button>
            ) : (
              <button type="button" className="secondary-btn" onClick={onCancel}>
                Fix Camera Setup
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
