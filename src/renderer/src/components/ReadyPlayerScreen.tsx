import { Bug } from './Chrome'

interface ReadyPlayerScreenProps {
  playerName: string
  playerIndex: number
  totalPlayers: number
  lap: number
  onStartCalibration: () => void
}

export function ReadyPlayerScreen({
  playerName,
  playerIndex,
  totalPlayers,
  lap,
  onStartCalibration
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
      <button type="button" className="primary-btn" onClick={onStartCalibration}>
        Start 8s Calibration
      </button>
      <Bug context={`Lap ${lap} · Player ${playerIndex + 1} of ${totalPlayers}`} />
    </div>
  )
}
