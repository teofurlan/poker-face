import { Bug } from './Chrome'

interface DemoIntroScreenProps {
  onStart: () => void
  onBack: () => void
}

// Shown before the demo starts: why a demo exists and what it is (the same label stays on screen
// during the demo as "Demo: recorded session").
export function DemoIntroScreen({ onStart, onBack }: DemoIntroScreenProps): React.JSX.Element {
  return (
    <div className="panel">
      <h1>
        Demo <em>round</em>
      </h1>
      <div className="demo-why">
        <p>
          <strong>Why a demo?</strong> The live game needs a webcam, a network connection and your
          own Presage API key, and every live session spends SDK credits. That would stop most
          people from trying it, so we added a way to see a full round without any of that.
        </p>
        <p>
          <strong>What it is.</strong> A real session recorded during development with the same SDK,
          replayed through the same crack detection: calibration, pressure meter, cracks, replay and
          leaderboard all run as in a live round. Your own face is not used and nothing is recorded.
        </p>
      </div>
      <div className="lobby-actions">
        <button type="button" className="primary-btn" onClick={onStart}>
          Start demo round
        </button>
        <button type="button" className="secondary-btn" onClick={onBack}>
          Back
        </button>
      </div>
      <Bug context="Demo · recorded session, no camera, no API key" />
    </div>
  )
}
