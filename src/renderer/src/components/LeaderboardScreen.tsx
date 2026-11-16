import { useEffect, useRef } from 'react'
import { emitSnapshot, sound } from '../audio/sound'
import type { CueSnapshot } from '../audio/cues'
import type { PlayerRanking } from '../game/sessionMachine'
import { Bug } from './Chrome'

interface LeaderboardScreenProps {
  lap: number
  rankings: PlayerRanking[]
  onRematch: () => void
  onNewSession: () => void
}

export function LeaderboardScreen({
  lap,
  rankings,
  onRematch,
  onNewSession
}: LeaderboardScreenProps): React.JSX.Element {
  const winner = rankings[0]

  // Sound: a short winner sting once when the final card appears.
  const cueRef = useRef<CueSnapshot | null>(null)
  useEffect(() => {
    emitSnapshot(cueRef, { phase: 'leaderboard' })
    return () => {
      cueRef.current = null
      sound.stopAll()
    }
  }, [])

  return (
    <div className={`panel leaderboard-panel ${rankings.length > 4 ? 'dense' : ''}`}>
      <h1>
        Final <em>card</em>
      </h1>

      <div className="leaderboard-table" role="table" aria-label="Player rankings">
        <div className="leaderboard-header" role="row">
          <span className="col-rank">#</span>
          <span className="col-name">Player</span>
          <span className="col-cracks">Cracks</span>
          <span className="col-time">First Crack</span>
        </div>

        {rankings.map((r) => (
          <div
            key={r.playerName}
            className={`leaderboard-row ${r.rank === 1 ? 'rank-1' : ''}`}
            role="row"
          >
            <span className="col-rank">{r.rank}</span>
            <span className="col-name">{r.playerName}</span>
            <span className="col-cracks">{r.voided ? 'VOID' : r.totalCracks}</span>
            <span className="col-time">
              {r.voided
                ? 'Voided'
                : r.firstCrackMs !== null
                  ? `${(r.firstCrackMs / 1000).toFixed(1)}s`
                  : 'Survived'}
            </span>
          </div>
        ))}
      </div>

      <div className="leaderboard-actions">
        {winner && !winner.voided && (
          <p className="winner-spotlight">
            <span className="winner-text">
              Winner: <strong>{winner.playerName}</strong> ({winner.totalCracks} cracks)
            </span>
          </p>
        )}
        <button type="button" className="primary-btn" onClick={onRematch}>
          Play Rematch (Lap {lap + 1})
        </button>
        <button type="button" className="secondary-btn" onClick={onNewSession}>
          New Session
        </button>
      </div>

      <Bug
        context={`Lap ${lap} complete · ${rankings.length} player${rankings.length === 1 ? '' : 's'}`}
      />
    </div>
  )
}
