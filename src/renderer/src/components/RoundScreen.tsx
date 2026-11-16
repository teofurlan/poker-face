import { useEffect, useRef, useState } from 'react'
import { createCrackDetector, type ExpressionScores } from '../game/crackDetector'
import { createPressureMeter, type VitalSample } from '../game/pressureMeter'
import type { PlayerRoundResult } from '../game/sessionMachine'
import { createRoundCues, sound } from '../audio/sound'
import { Bug, TrendMark } from './Chrome'

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

  // Sound: reacts to existing state only (crack onset, last-10-seconds ticks, final bell).
  const [roundCues] = useState(createRoundCues)

  const detectorRef = useRef(createCrackDetector({ baseline }))
  const pressureRef = useRef(createPressureMeter({ settleDurationMs: 20000 }))

  const spokeEventsRef = useRef<number[]>([])
  const faceLossMsRef = useRef<number>(0)
  const lastFaceLossStartRef = useRef<number | null>(null)
  const roundStartMsRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)

  // The parent passes new callbacks each render; keep the latest without restarting the round.
  const onRoundFinishedRef = useRef(onRoundFinished)
  const registerRoundEventsRef = useRef(registerRoundEvents)
  useEffect(() => {
    onRoundFinishedRef.current = onRoundFinished
    registerRoundEventsRef.current = registerRoundEvents
  })

  useEffect(() => {
    finishedRef.current = false
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

      // Decrement round timer (pure updater: the finish and the sound cues run in an effect below)
      setSecondsLeft((prev) => Math.max(0, prev - 1))

      pressureRef.current.tick(elapsedTotal)
      const pState = pressureRef.current.getState()
      setPressureScore(pState.pressureScore)
      setPulseBpm(pState.pulseBpm)
      setBreathingRate(pState.breathingRate)
      setPressureStatus(pState.status)
      setPressureTrend(pState.trend)
    }, 1000)
    intervalRef.current = interval

    const unregister = registerRoundEventsRef.current?.({
      onExpression: (scores, ts) => {
        const res = detectorRef.current.processSample(scores, ts)
        roundCues.update({ totalCracks: res.totalCracks, isCracking: res.isCracking })
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
  }, [baseline, roundCues])

  // Clock side effects run here, never inside the state updater (React may call that during render).
  useEffect(() => {
    roundCues.update({ secondsLeft })
    if (secondsLeft > 0 || finishedRef.current) return
    finishedRef.current = true
    if (intervalRef.current) clearInterval(intervalRef.current)
    const state = detectorRef.current.getState()
    onRoundFinishedRef.current({
      totalCracks: state.totalCracks,
      firstCrackMs: state.firstCrackMs,
      cracks: state.cracks,
      spokeEvents: [...spokeEventsRef.current],
      faceLossTotalMs: faceLossMsRef.current,
      voided: false
    })
  }, [secondsLeft, roundCues])

  // Arena hush follows the pressure meter (room mood only); stop sound when leaving the round.
  useEffect(() => {
    sound.setAmbience(pressureStatus === 'settling' ? 0 : pressureScore / 100)
  }, [pressureScore, pressureStatus])
  useEffect(
    () => () => {
      // Let the final bell ring out after a natural finish; cut everything otherwise.
      if (roundCues.isFinished()) sound.stopAmbience()
      else sound.stopAll()
      roundCues.reset()
    },
    [roundCues]
  )

  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  const SEGMENTS = 30
  const litSegments = Math.round((Math.min(100, Math.max(0, pressureScore)) / 100) * SEGMENTS)
  const crackHit = cracksCount > 0

  return (
    <div className="panel round-panel">
      <div className="round-top">
        <div className="round-player">
          <span className="round-tag" aria-hidden="true" />
          <div>
            <small>In the hot seat</small>
            <span className="round-name">{playerName}</span>
          </div>
        </div>
        <div className="round-timer" aria-label={`${secondsLeft} seconds left`}>
          {clock}
        </div>
        <div className="round-side">
          <button type="button" className="abort-btn" onClick={onAbort}>
            Abort Round
          </button>
        </div>
      </div>

      <div className="round-stage">
        {crackHit && <div key={`edge-${cracksCount}`} className="crack-edge" aria-hidden="true" />}

        <div className={`cracks-card cracks ${isCracking ? 'alert' : ''}`}>
          <div className="cracks-title">Cracks</div>
          <div
            key={`n-${cracksCount}`}
            className={`cracks-display ${crackHit ? 'thud' : ''} ${isCracking ? 'is-cracking' : ''}`}
          >
            {cracksCount}
          </div>
          {isCracking && <div className="cracks-state">Cracking now</div>}
          <div className="variation">
            <div className="variation-bar-container">
              <div
                className={`variation-bar-fill ${currentVariation >= 40 ? 'danger' : ''}`}
                style={{ width: `${Math.min(100, currentVariation)}%` }}
              />
              <div className="variation-threshold" title="Crack threshold (40)" />
            </div>
            <div className="variation-label">
              Variation: {currentVariation} / 100{currentVariation >= 40 ? ' · over the line' : ''}
            </div>
          </div>
        </div>

        {crackHit && (
          <div
            key={`slam-${cracksCount}`}
            className={`slam ${isCracking ? 'is-cracking' : ''}`}
            role="status"
          >
            <b>Crack!</b>
            <span>That&apos;s {cracksCount}</span>
          </div>
        )}

        {/* Ambient crowd-noise meter for the room. Not a measurement; no effect on score. */}
        <div className="pressure-card">
          <div className="pm-row">
            <h2 className="meter-title">
              Room pressure <TrendMark trend={pressureTrend} />
            </h2>
            <p className="pm-note">
              Ambient mood from slow pulse and breathing. Just for the room, not a measurement.
            </p>
          </div>
          <div
            className="segs"
            role="meter"
            aria-label={`Room pressure, ${litSegments} of ${SEGMENTS}`}
            aria-valuemin={0}
            aria-valuemax={SEGMENTS}
            aria-valuenow={litSegments}
          >
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <i
                key={i}
                className={i < litSegments ? (i >= litSegments - 2 ? 'on hot' : 'on') : ''}
              />
            ))}
          </div>
          <div className="pm-scale">
            <span>Quiet room</span>
            <span className="vitals-stats">
              <span>{pressureScore}%</span>
              <span>Pulse: {pulseBpm ? `${pulseBpm} BPM` : 'reading...'}</span>
              <span>Breathing: {breathingRate ? `${breathingRate}/min` : 'reading...'}</span>
              <span className="meter-status">[{pressureStatus}]</span>
            </span>
            <span>Loud room</span>
          </div>
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
            <div>
              <h2>Back in frame</h2>
              <p>Clock paused. Move back into frame!</p>
            </div>
          </div>
        )}
      </div>

      <Bug
        context="Fewest cracks wins · later first crack breaks a tie"
        note="For entertainment only. Not a medical device or lie detector."
      />
    </div>
  )
}
