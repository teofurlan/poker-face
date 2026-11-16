import type { PlayerRanking } from '../game/sessionMachine'

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

  return (
    <div className="panel leaderboard-panel">
      <p className="muted">Lap {lap} Complete</p>
      <h1>Session Leaderboard</h1>

      {winner && !winner.voided && (
        <div className="winner-spotlight">
          <span className="trophy-icon">🏆</span>
          <span className="winner-text">
            Winner: <strong>{winner.playerName}</strong> ({winner.totalCracks} cracks)
          </span>
        </div>
      )}

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
            <span className="col-rank">#{r.rank}</span>
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
        <button type="button" className="primary-btn" onClick={onRematch}>
          Play Rematch (Lap {lap + 1})
        </button>
        <button type="button" className="secondary-btn" onClick={onNewSession}>
          New Session
        </button>
      </div>
    </div>
  )
}
