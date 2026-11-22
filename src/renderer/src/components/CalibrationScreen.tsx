import { useEffect, useRef, useState } from 'react'
import { createBaselineCalibrator, type ExpressionScores } from '../game/crackDetector'
import {
  createFramingGate,
  describeCalibrationFailure,
  describeValidation
} from '../game/calibration'
import { emitSnapshot, sound } from '../audio/sound'
import type { CueSnapshot } from '../audio/cues'
import { Bug } from './Chrome'

const CALIBRATION_MS = 8000

export interface CalibrationStatus {
  validationCode: number
  expressions?: ExpressionScores
  error: string | null
}

interface CalibrationScreenProps {
  playerName: string
  onCalibrated: (baseline: ExpressionScores) => void
  onCancel: () => void | Promise<void>
  cameraError?: string | null
  registerStatusReceiver: (fn: (status: CalibrationStatus) => void) => () => void
}

type Stage = 'framing' | 'calibrating' | 'failed'

export function CalibrationScreen({
  playerName,
  onCalibrated,
  onCancel,
  cameraError,
  registerStatusReceiver
}: CalibrationScreenProps): React.JSX.Element {
  const [stage, setStage] = useState<Stage>('framing')
  const [attempt, setAttempt] = useState(0)
  const [retriesLeft, setRetriesLeft] = useState(2)
  const [msLeft, setMsLeft] = useState(CALIBRATION_MS)
  const [hint, setHint] = useState('Starting camera')
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Keep the latest callbacks without restarting the attempt when the parent re-renders.
  const onCalibratedRef = useRef(onCalibrated)
  const onCancelRef = useRef(onCancel)
  const registerRef = useRef(registerStatusReceiver)
  const cancellingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    onCalibratedRef.current = onCalibrated
    onCancelRef.current = onCancel
    registerRef.current = registerStatusReceiver
  })
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  const handleCancel = (): void => {
    if (cancellingRef.current) return
    cancellingRef.current = true
    setCancelling(true)
    Promise.resolve(onCancelRef.current()).catch(() => {
      cancellingRef.current = false
      if (mountedRef.current) setCancelling(false)
    })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.repeat) handleCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const gate = createFramingGate({ requiredMs: 1000 })
    const calibrator = createBaselineCalibrator({ durationMs: CALIBRATION_MS, minValidRatio: 0.8 })
    let startedAt: number | null = null
    let done = false

    const finish = (): void => {
      if (done || cancellingRef.current) return
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
      if (done || cancellingRef.current) return
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
      if (startedAt === null || done || cancellingRef.current) return
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
    if (cancellingRef.current) return
    setFailure(null)
    setStage('framing')
    setMsLeft(CALIBRATION_MS)
    setRetriesLeft((r) => r - 1)
    setAttempt((a) => a + 1)
  }

  const secondsLeft = Math.ceil(msLeft / 1000)

  // Sound: a bell for each countdown second. Silence while framing or cancelling.
  const cueRef = useRef<CueSnapshot | null>(null)
  useEffect(() => {
    emitSnapshot(cueRef, {
      phase: 'calibration',
      calSecondsLeft: stage === 'calibrating' && !cancelling ? secondsLeft : null
    })
  }, [stage, secondsLeft, cancelling])
  useEffect(
    () => () => {
      cueRef.current = null
      sound.stopAll()
    },
    []
  )

  if (cameraError) {
    return (
      <div className="panel calibration-panel">
        <h1>Camera unavailable</h1>
        <p className="cal-who">Calibrating Hot Seat: {playerName}</p>
        <p className="error">{cameraError}</p>
        <div className="calibration-actions">
          <button
            type="button"
            className="secondary-btn"
            disabled={cancelling}
            onClick={handleCancel}
          >
            {cancelling ? 'Stopping camera…' : 'Back'}
          </button>
        </div>
        <Bug context="Calibration · camera unavailable" />
      </div>
    )
  }

  const litSegments = Math.floor((CALIBRATION_MS - msLeft) / 1000)

  return (
    <div className={`panel calibration-panel ${stage === 'calibrating' ? 'counting' : ''}`}>
      {stage === 'framing' && (
        <>
          <div className="oval" aria-hidden="true" />
          <h1 className="cal-title">Get in frame</h1>
          <p className="cal-who">Calibrating Hot Seat: {playerName}</p>
          <p className="cal-hint">
            <small>Camera says</small>
            <span className="validation">{hint}</span>
          </p>
          <p className="hint">Calibration starts once your face is clearly visible.</p>
          <div className="calibration-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling ? 'Stopping camera…' : 'Cancel'}
            </button>
          </div>
        </>
      )}

      {stage === 'calibrating' && (
        <>
          <p className="cal-who">Calibrating Hot Seat: {playerName}</p>
          <h1 className="cal-cap">Calibrating: {secondsLeft}s</h1>
          <div className="countdown-ring" aria-hidden="true">
            {secondsLeft}
          </div>
          <div
            className="progress-bar-container"
            role="progressbar"
            aria-label="Calibration progress"
            aria-valuemin={0}
            aria-valuemax={8}
            aria-valuenow={litSegments}
          >
            {Array.from({ length: CALIBRATION_MS / 1000 }, (_, i) => (
              <i key={i} className={i < litSegments ? 'on' : ''} />
            ))}
          </div>
          <p className="validation">{hint}</p>
          <p className="hint">Challengers, stay quiet while we learn the resting face.</p>
          <div className="calibration-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling ? 'Stopping camera…' : 'Cancel'}
            </button>
          </div>
        </>
      )}

      {stage === 'failed' && (
        <>
          <h1>Calibration Failed</h1>
          <p className="cal-who">Calibrating Hot Seat: {playerName}</p>
          <p className="error">{failure}</p>
          <div className="calibration-actions">
            {retriesLeft > 0 && (
              <button
                type="button"
                className="primary-btn"
                disabled={cancelling}
                onClick={handleRetry}
              >
                Try Calibration Again ({retriesLeft} retries left)
              </button>
            )}
            <button
              type="button"
              className="secondary-btn"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling ? 'Stopping camera…' : retriesLeft > 0 ? 'Cancel' : 'Back'}
            </button>
          </div>
        </>
      )}

      {sdkError && <p className="error">{sdkError}</p>}

      <Bug
        context={`Calibration · ${playerName}`}
        note={
          stage === 'calibrating'
            ? 'The round starts with zero cracks'
            : 'Nothing is recorded or stored'
        }
      />
    </div>
  )
}
