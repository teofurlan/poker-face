interface ConsentScreenProps {
  players: string[]
  onConfirmConsent: () => void
  onBackToLobby: () => void
}

export function ConsentScreen({
  players,
  onConfirmConsent,
  onBackToLobby
}: ConsentScreenProps): React.JSX.Element {
  return (
    <div className="panel consent-panel">
      <h1>Consent & Privacy</h1>
      <p className="muted">Before we start, everyone must agree to take part.</p>

      <div className="consent-box">
        <p>
          <strong>Players taking the hot seat:</strong>
        </p>
        <div className="consent-names">
          {players.map((p, idx) => (
            <span key={p} className="consent-chip">
              #{idx + 1} {p}
            </span>
          ))}
        </div>

        <ul className="consent-points">
          <li>
            <strong>Camera sensing:</strong> The camera runs only during each player&apos;s own
            round to measure microexpressions and room tension.
          </li>
          <li>
            <strong>Private & on-device:</strong> Processing happens locally on your computer. No
            video is ever recorded, stored, or uploaded.
          </li>
          <li>
            <strong>Pure entertainment:</strong> This is a party game, not a lie detector or medical
            instrument.
          </li>
          <li>
            <strong>One agreement:</strong> Pressing the button confirms that everyone listed
            agrees. Anyone unwilling must be removed from the lobby first.
          </li>
        </ul>
      </div>

      <div className="consent-actions">
        <button type="button" className="primary-btn" onClick={onConfirmConsent}>
          Everyone Agrees — Start Game
        </button>
        <button type="button" className="secondary-btn" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  )
}
