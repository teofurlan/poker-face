import { Bug } from './Chrome'

interface ReadyPlayerScreenProps {
  playerName: string
  playerIndex: number
  totalPlayers: number
  lap: number
  onStartCalibration: () => void
  onBackToLobby?: () => void
  backLabel?: string
}

export function ReadyPlayerScreen({
  playerName,
  playerIndex,
  totalPlayers,
  lap,
  onStartCalibration,
  onBackToLobby,
  backLabel = 'Back to Lobby'
}: ReadyPlayerScreenProps): React.JSX.Element {
  return (
    <div className="panel ready-panel">
      <h1>Next in the Hot Seat</h1>
      <div className="hot-seat-badge">{playerName}</div>
      <p className="ready-rules">
        <strong>Player:</strong> Sit facing the camera. Keep a straight face in silence.
        <br />
        <strong>Challengers:</strong> Your turn to make them crack!
      </p>
      <div className="ready-actions">
        <button type="button" className="primary-btn" onClick={onStartCalibration}>
          Start 8s Calibration
        </button>
        {onBackToLobby && (
          <button type="button" className="secondary-btn" onClick={onBackToLobby}>
            {backLabel}
          </button>
        )}
      </div>
      <Bug context={`Lap ${lap} · Player ${playerIndex + 1} of ${totalPlayers}`} />
    </div>
  )
}
