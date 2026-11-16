import { useEffect, useRef, useState } from 'react'
import type { PlayerRoundResult } from '../game/sessionMachine'
import { Bug } from './Chrome'

interface ReplayScreenProps {
  result: PlayerRoundResult
  isLastPlayerInLap: boolean
  onNext: () => void
}

export function ReplayScreen({
  result,
  isLastPlayerInLap,
  onNext
}: ReplayScreenProps): React.JSX.Element {
  const [countdown, setCountdown] = useState(15)
  // The parent passes a new onNext each render; keep the latest without restarting the timer.
  const onNextRef = useRef(onNext)
  useEffect(() => {
    onNextRef.current = onNext
  })

  useEffect(() => {
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(timer)
  }, [])

  // Advance from an effect, never from inside a state updater (that runs during render).
  useEffect(() => {
    if (countdown === 0) onNextRef.current()
  }, [countdown])

  return (
    <div className="panel replay-panel">
      <h1>
        {result.voided
          ? 'Round Voided (Face Lost > 10s)'
          : result.totalCracks === 0
            ? 'Incredible! 0 Cracks!'
            : `${result.totalCracks} Crack${result.totalCracks > 1 ? 's' : ''}`}
      </h1>
      <p className="replay-sub">Round Replay · Hot Seat: {result.playerName}</p>

      <div className="replay-stats">
        <div className="stat-box">
          <span className="stat-label">Time to first crack</span>
          <span className="stat-value">
            {result.firstCrackMs !== null
              ? `${(result.firstCrackMs / 1000).toFixed(1)}s`
              : 'Survived (60s)'}
          </span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Spoke marks</span>
          <span className="stat-value">{result.spokeEvents.length}</span>
        </div>
      </div>

      {/* 60s Visual Timeline */}
      <div className="timeline-container">
        <div className="timeline-labels">
          <span>0s</span>
          <span>15s</span>
          <span>30s</span>
          <span>45s</span>
          <span>60s</span>
        </div>
        <div className="timeline-track">
          {/* Render crack pins */}
          {result.cracks.map((c, i) => {
            const leftPercent = Math.min(100, Math.max(0, (c.startMs / 60000) * 100))
            const widthPercent = Math.max(
              2,
              Math.min(100 - leftPercent, ((c.endMs - c.startMs) / 60000) * 100)
            )
            return (
              <div
                key={i}
                className="timeline-crack-pin"
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                title={`Crack #${i + 1} at ${(c.startMs / 1000).toFixed(1)}s (Peak ${Math.round(c.peakVariation)})`}
              />
            )
          })}

          {/* Render spoke pins */}
          {result.spokeEvents.map((ts, i) => {
            const leftPercent = Math.min(100, Math.max(0, (ts / 60000) * 100))
            return (
              <div
                key={i}
                className="timeline-spoke-pin"
                style={{ left: `${leftPercent}%` }}
                title={`Spoke at ${(ts / 1000).toFixed(1)}s`}
              />
            )
          })}
        </div>
      </div>

      <div className="timeline-key" aria-hidden="true">
        <span>
          <i className="k-crack" /> Crack
        </span>
        <span>
          <i className="k-spoke" /> Spoke
        </span>
      </div>

      <div className="replay-actions">
        <button type="button" className="primary-btn" onClick={onNext}>
          {isLastPlayerInLap ? 'View Leaderboard' : 'Next Player'} ({countdown}s)
        </button>
      </div>

      <Bug context={`Round replay · ${result.playerName}`} />
    </div>
  )
}
