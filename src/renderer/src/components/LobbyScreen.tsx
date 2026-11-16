import { useState } from 'react'

interface LobbyScreenProps {
  players: string[]
  onAddPlayer: (name: string) => boolean
  onRemovePlayer: (name: string) => void
  onStart: () => void
  onBackToCamera?: () => void
}

export function LobbyScreen({
  players,
  onAddPlayer,
  onRemovePlayer,
  onStart,
  onBackToCamera
}: LobbyScreenProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!name.trim()) return
    const success = onAddPlayer(name)
    if (success) {
      setName('')
      setError(null)
    } else {
      if (players.length >= 6) {
        setError('Maximum 6 players per session.')
      } else if (players.includes(name.trim())) {
        setError('Player name already added.')
      } else {
        setError('Invalid name.')
      }
    }
  }

  return (
    <div className="panel lobby-panel">
      <h1>Player Lobby</h1>
      <p className="muted">1 to 6 players in the hot seat, played in entry order.</p>

      {players.length < 6 && (
        <form className="lobby-form" onSubmit={handleAdd}>
          <input
            type="text"
            autoFocus
            placeholder="Enter player name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New player name"
          />
          <button type="submit" disabled={!name.trim()}>
            Add Player
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <div className="player-list" role="list">
        {players.map((p, idx) => (
          <div key={p} className="player-chip" role="listitem">
            <span className="player-number">#{idx + 1}</span>
            <span className="player-name">{p}</span>
            <button
              type="button"
              className="remove-btn"
              onClick={() => onRemovePlayer(p)}
              aria-label={`Remove ${p}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="lobby-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={players.length === 0}
          onClick={onStart}
        >
          {players.length === 0
            ? 'Add players to start'
            : `Continue with ${players.length} player${players.length > 1 ? 's' : ''}`}
        </button>
        {onBackToCamera && (
          <button type="button" className="secondary-btn" onClick={onBackToCamera}>
            Change Camera
          </button>
        )}
      </div>
    </div>
  )
}
