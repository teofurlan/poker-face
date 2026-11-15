import { useEffect, useRef, useState } from 'react'
import { createBaselineCalibrator, type ExpressionScores } from '../game/crackDetector'
import {
  createFramingGate,
  describeCalibrationFailure,
  describeValidation
} from '../game/calibration'

const CALIBRATION_MS = 8000

export interface CalibrationStatus {
  validationCode: number
  expressions?: ExpressionScores
  error: string | null
}

interface CalibrationScreenProps {
  playerName: string
  onCalibrated: (baseline: ExpressionScores) => void
  onCancel: () => void
  registerStatusReceiver: (fn: (status: CalibrationStatus) => void) => () => void
}

type Stage = 'framing' | 'calibrating' | 'failed'

export function CalibrationScreen({
  playerName,
  onCalibrated,
  onCancel,
  registerStatusReceiver
}: CalibrationScreenProps): React.JSX.Element {
  const [stage, setStage] = useState<Stage>('framing')
  const [attempt, setAttempt] = useState(0)
  const [retriesLeft, setRetriesLeft] = useState(2)
  const [msLeft, setMsLeft] = useState(CALIBRATION_MS)
  const [hint, setHint] = useState('Starting camera')
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  // Keep the latest callbacks without restarting the attempt when the parent re-renders.
  const onCalibratedRef = useRef(onCalibrated)
  const registerRef = useRef(registerStatusReceiver)
  useEffect(() => {
    onCalibratedRef.current = onCalibrated
    registerRef.current = registerStatusReceiver
  })

  useEffect(() => {
    const gate = createFramingGate({ requiredMs: 1000 })
    const calibrator = createBaselineCalibrator({ durationMs: CALIBRATION_MS, minValidRatio: 0.8 })
    let startedAt: number | null = null
    let done = false

    const finish = (): void => {
      if (done) return
      done = true
      const result = calibrator.finish()
      if (result.ok) {
        onCalibratedRef.current(result.baseline)
      } else {
        setFailure(describeCalibrationFailure(result))
        setStage('failed')
      }
    }

    const unregister = registerRef.current((status) => {
      if (done) return
      setHint(describeValidation(status.validationCode))
      setSdkError(status.error)
      const now = Date.now()
      if (startedAt === null) {
        if (gate.update(status.validationCode, now)) {
          startedAt = now
          setStage('calibrating')
        }
        return
      }
      if (status.expressions) calibrator.addSample(status.expressions, status.validationCode)
    })

    const ticker = setInterval(() => {
      if (startedAt === null || done) return
      const left = CALIBRATION_MS - (Date.now() - startedAt)
      setMsLeft(Math.max(0, left))
      if (left <= 0) finish()
    }, 200)

    return () => {
      done = true
      clearInterval(ticker)
      unregister()
    }
  }, [attempt])

  const handleRetry = (): void => {
    setFailure(null)
    setStage('framing')
    setMsLeft(CALIBRATION_MS)
    setRetriesLeft((r) => r - 1)
    setAttempt((a) => a + 1)
  }

  const secondsLeft = Math.ceil(msLeft / 1000)

  return (
    <div className="panel calibration-panel">
      <p className="muted">Calibrating Hot Seat: {playerName}</p>

      {stage === 'framing' && (
        <>
          <h1>Get in frame</h1>
          <p className="validation">{hint}</p>
          <p className="hint">Calibration starts once your face is clearly visible.</p>
        </>
      )}

      {stage === 'calibrating' && (
        <>
          <h1>Calibrating: {secondsLeft}s</h1>
          <div className="countdown-ring">{secondsLeft}</div>
          <p className="validation">{hint}</p>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${((CALIBRATION_MS - msLeft) / CALIBRATION_MS) * 100}%` }}
            />
          </div>
          <p className="hint">Challengers, stay quiet while we learn the resting face.</p>
        </>
      )}

      {stage === 'failed' && (
        <>
          <h1>Calibration Failed</h1>
          <p className="error">{failure}</p>
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

      {sdkError && <p className="error">{sdkError}</p>}
    </div>
  )
}
