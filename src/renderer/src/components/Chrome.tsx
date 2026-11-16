// Shared Fight Night chrome: the broadcast "bug" pinned to the bottom of every screen.
// Purely presentational. Context text says where we are; the note says what the app promises.

import { setSoundMuted, useSoundMuted } from '../audio/sound'

// Sound on/off, remembered across restarts. Icon shape + the word On/Off, never colour alone.
function SoundToggle(): React.JSX.Element {
  const muted = useSoundMuted()
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-label="Sound"
      aria-pressed={!muted}
      onClick={() => setSoundMuted(!muted)}
    >
      <svg viewBox="0 0 16 16" width="1.1em" height="1.1em" aria-hidden="true">
        <path d="M1 6h3l4-3v10l-4-3H1z" fill="currentColor" />
        {muted ? (
          <path d="M10 5l5 6M15 5l-5 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
        ) : (
          <path
            d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
        )}
      </svg>
      Sound: {muted ? 'Off' : 'On'}
    </button>
  )
}

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
      <SoundToggle />
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
