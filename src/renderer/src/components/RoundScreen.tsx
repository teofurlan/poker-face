import { useEffect, useRef, useState } from 'react'
import { createCrackDetector, type ExpressionScores } from '../game/crackDetector'
import { createPressureMeter, type VitalSample } from '../game/pressureMeter'
import type { PlayerRoundResult } from '../game/sessionMachine'

interface RoundScreenProps {
  playerName: string
  baseline: ExpressionScores
  onRoundFinished: (result: Omit<PlayerRoundResult, 'playerName'>) => void
  onAbort: () => void
  registerRoundEvents?: (handlers: {
    onExpression: (scores: ExpressionScores, ts: number) => void
    onPulse: (sample: VitalSample, ts: number) => void
    onBreathing: (sample: VitalSample, ts: number) => void
    onValidation: (code: number, ts: number) => void
    onTalking: (detected: boolean, ts: number) => void
  }) => () => void
}

export function RoundScreen({
  playerName,
  baseline,
  onRoundFinished,
  onAbort,
  registerRoundEvents
}: RoundScreenProps): React.JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [isFaceLost, setIsFaceLost] = useState(false)
  const [isVoided, setIsVoided] = useState(false)

  // Crack detector state
  const [cracksCount, setCracksCount] = useState(0)
  const [isCracking, setIsCracking] = useState(false)
  const [currentVariation, setCurrentVariation] = useState(0)

  // Pressure meter state
  const [pressureScore, setPressureScore] = useState(0)
  const [pulseBpm, setPulseBpm] = useState<number | null>(null)
  const [breathingRate, setBreathingRate] = useState<number | null>(null)
  const [pressureStatus, setPressureStatus] = useState<string>('settling')
  const [pressureTrend, setPressureTrend] = useState<string>('steady')

  const detectorRef = useRef(createCrackDetector({ baseline }))
  const pressureRef = useRef(createPressureMeter({ settleDurationMs: 20000 }))

  const spokeEventsRef = useRef<number[]>([])
  const faceLossMsRef = useRef<number>(0)
  const lastFaceLossStartRef = useRef<number | null>(null)
  const roundStartMsRef = useRef<number>(0)

  useEffect(() => {
    detectorRef.current.reset()
    pressureRef.current.reset()
    spokeEventsRef.current = []
    faceLossMsRef.current = 0
    lastFaceLossStartRef.current = null
    roundStartMsRef.current = Date.now()

    // 100ms game loop tick for timers and countdown
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedTotal = now - roundStartMsRef.current

      // If face is currently lost, accumulate face loss time
      if (lastFaceLossStartRef.current !== null) {
        const lossDuration = now - lastFaceLossStartRef.current
        const totalLoss = faceLossMsRef.current + lossDuration
        if (totalLoss > 10000) {
          setIsVoided(true)
          clearInterval(interval)
          return
        }
        return // Paused clock while face is lost
      }

      // Decrement round timer
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          const state = detectorRef.current.getState()
          onRoundFinished({
            totalCracks: state.totalCracks,
            firstCrackMs: state.firstCrackMs,
            cracks: state.cracks,
            spokeEvents: [...spokeEventsRef.current],
            faceLossTotalMs: faceLossMsRef.current,
            voided: false
          })
          return 0
        }
        return prev - 1
      })

      pressureRef.current.tick(elapsedTotal)
      const pState = pressureRef.current.getState()
      setPressureScore(pState.pressureScore)
      setPulseBpm(pState.pulseBpm)
      setBreathingRate(pState.breathingRate)
      setPressureStatus(pState.status)
      setPressureTrend(pState.trend)
    }, 1000)

    const unregister = registerRoundEvents?.({
      onExpression: (scores, ts) => {
        const res = detectorRef.current.processSample(scores, ts)
        setCracksCount(res.totalCracks)
        setIsCracking(res.isCracking)
        setCurrentVariation(Math.round(res.currentVariation))
      },
      onPulse: (sample, ts) => {
        pressureRef.current.addPulse(sample, ts)
      },
      onBreathing: (sample, ts) => {
        pressureRef.current.addBreathing(sample, ts)
      },
      onValidation: (code, ts) => {
        pressureRef.current.setValidationStatus(code, ts)
        if (code === 1) {
          // Face lost
          if (lastFaceLossStartRef.current === null) {
            lastFaceLossStartRef.current = Date.now()
            setIsFaceLost(true)
          }
        } else {
          // Face recovered
          if (lastFaceLossStartRef.current !== null) {
            faceLossMsRef.current += Date.now() - lastFaceLossStartRef.current
            lastFaceLossStartRef.current = null
            setIsFaceLost(false)
          }
        }
      },
      onTalking: (detected, ts) => {
        if (detected) {
          spokeEventsRef.current.push(ts)
        }
      }
    })

    return () => {
      clearInterval(interval)
      unregister?.()
    }
  }, [baseline, onRoundFinished, registerRoundEvents])

  return (
    <div className={`panel round-panel ${isCracking ? 'cracking-active' : ''}`}>
      <div className="round-header">
        <span className="hot-seat-player">Hot Seat: {playerName}</span>
        <span className="round-timer">{secondsLeft}s</span>
      </div>

      {isVoided && (
        <div className="void-banner" role="alert">
          <h2>Round Voided</h2>
          <p>Face lost for more than 10 seconds.</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              onRoundFinished({
                totalCracks: detectorRef.current.getState().totalCracks,
                firstCrackMs: detectorRef.current.getState().firstCrackMs,
                cracks: detectorRef.current.getState().cracks,
                spokeEvents: [...spokeEventsRef.current],
                faceLossTotalMs: faceLossMsRef.current,
                voided: true
              })
            }}
          >
            Continue (Voided)
          </button>
        </div>
      )}

      {isFaceLost && !isVoided && (
        <div className="paused-banner" role="alert">
          <h2>Clock Paused</h2>
          <p>Move back into frame!</p>
        </div>
      )}

      <div className="meters-grid">
        {/* Cracks Meter */}
        <div className={`meter-card cracks-card ${isCracking ? 'alert' : ''}`}>
          <div className="meter-title">CRACKS</div>
          <div className="cracks-display">{cracksCount}</div>
          <div className="variation-bar-container">
            <div
              className={`variation-bar-fill ${currentVariation >= 40 ? 'danger' : ''}`}
              style={{ width: `${Math.min(100, currentVariation)}%` }}
            />
            <div className="variation-threshold" title="Crack threshold (40)" />
          </div>
          <div className="variation-label">Variation: {currentVariation} / 100</div>
        </div>

        {/* Room Pressure Meter */}
        <div className="meter-card pressure-card">
          <div className="meter-title">
            ROOM PRESSURE{' '}
            {pressureTrend === 'rising' ? '▲' : pressureTrend === 'dropping' ? '▼' : '—'}
          </div>
          <div className="pressure-display">{pressureScore}%</div>
          <div className="pressure-bar-container">
            <div className="pressure-bar-fill" style={{ width: `${pressureScore}%` }} />
          </div>
          <div className="vitals-stats">
            <span>Pulse: {pulseBpm ? `${pulseBpm} BPM` : 'reading...'}</span>
            <span>Breathing: {breathingRate ? `${breathingRate}/min` : 'reading...'}</span>
            <span className="meter-status">[{pressureStatus}]</span>
          </div>
        </div>
      </div>

      <div className="round-footer">
        <p className="muted entertainment-disclaimer">
          For entertainment only. Not a medical device or lie detector.
        </p>
        <button type="button" className="abort-btn" onClick={onAbort}>
          Abort Round
        </button>
      </div>
    </div>
  )
}
