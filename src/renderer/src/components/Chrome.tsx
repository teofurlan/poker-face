// Shared Fight Night chrome: the broadcast "bug" pinned to the bottom of every screen.
// Purely presentational. Context text says where we are; the note says what the app promises.

interface BugProps {
  context?: string
  note?: string
}

export function Bug({
  context,
  note = 'Nothing is recorded or stored'
}: BugProps): React.JSX.Element {
  return (
    <footer className="bug">
      <b className="bug-brand">Poker Face</b>
      {context && <span className="bug-context">{context}</span>}
      <span className="bug-note">{note}</span>
    </footer>
  )
}

// Drawn (not glyph) trend marker for the ambient pressure meter: shape + word, never colour alone.
export function TrendMark({ trend }: { trend: string }): React.JSX.Element {
  const label = trend === 'rising' ? 'Rising' : trend === 'dropping' ? 'Dropping' : 'Steady'
  return (
    <span className="trend">
      <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
        {trend === 'rising' ? (
          <path d="M8 2 15 14H1z" fill="currentColor" />
        ) : trend === 'dropping' ? (
          <path d="M8 14 1 2h14z" fill="currentColor" />
        ) : (
          <path d="M1 6h14v4H1z" fill="currentColor" />
        )}
      </svg>
      {label}
    </span>
  )
}
