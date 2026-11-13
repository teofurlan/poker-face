import { useEffect, useRef, useState } from 'react'
import type { FaceStatus } from '../../preload'
import { CalibrationScreen } from './components/CalibrationScreen'
import { ConsentScreen } from './components/ConsentScreen'
import { LeaderboardScreen } from './components/LeaderboardScreen'
import { LobbyScreen } from './components/LobbyScreen'
import { ReadyPlayerScreen } from './components/ReadyPlayerScreen'
import { ReplayScreen } from './components/ReplayScreen'
import { RoundScreen } from './components/RoundScreen'
import type { ExpressionScores } from './game/crackDetector'
import type { VitalSample } from './game/pressureMeter'
import {
  createSessionMachine,
  type PlayerRoundResult,
  type SessionState
} from './game/sessionMachine'

type Camera = { id: string; name: string }
type Screen = 'loading' | 'key' | 'camera' | 'test_camera' | 'game'

function KeyScreen({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const result = await window.api.saveKey(key)
    if (result.ok) onSaved()
    else setError(result.error)
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h1>Your Presage API key</h1>
      <p>
        Get a free key at <strong>physiology.presagetech.com</strong>. It is saved only on this
        computer, encrypted.
      </p>
      <input
        type="password"
        autoFocus
        value={key}
        onChange={(e) => setKey(e.target.value)}
        aria-label="Presage API key"
      />
      {error && <p className="error">{error}</p>}
      <button type="submit">Save key</button>
    </form>
  )
}

function CameraScreen({
  onChosen,
  onTest
}: {
  onChosen: (camera: Camera) => void
  onTest: (camera: Camera) => void
}): React.JSX.Element {
  const [cameras, setCameras] = useState<Camera[] | null>(null)
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    window.api
      .listCameras()
      .then((result) => {
        const { cameras, selectedId } = result
        setError(result.error ?? null)
        setCameras(cameras)
        setSelected(selectedId ?? cameras[0]?.id ?? '')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setCameras([])
      })
  }, [])
  if (!cameras) return <div className="panel">Looking for cameras…</div>
  if (!cameras.length)
    return (
      <div className="panel">
        <h1>No camera found</h1>
        <p className="error">{error ?? 'Connect a camera and restart Poker Face.'}</p>
      </div>
    )
  const chosen = cameras.find((c) => c.id === selected)
  return (
    <div className="panel">
      <h1>Pick your camera</h1>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Camera">
        {cameras.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="lobby-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!chosen}
          onClick={() => chosen && onChosen(chosen)}
        >
          Use for Game
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={!chosen}
          onClick={() => chosen && onTest(chosen)}
        >
          Test Camera
        </button>
      </div>
    </div>
  )
}

function TestCameraScreen({
  camera,
  onBack
}: {
  camera: Camera
  onBack: () => void
}): React.JSX.Element {
  const [status, setStatus] = useState<FaceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const off = window.api.onFaceStatus(setStatus)
    window.api.startFace(camera.id).then((r) => {
      if (!r.ok) setError(r.error)
    })
    return () => {
      off()
      window.api.stopFace()
    }
  }, [camera.id])
  const face = status?.faceDetected
  return (
    <div className="panel">
      <p className="muted">{camera.name}</p>
      <div className={`face ${face ? 'on' : 'off'}`}>{face ? 'FACE' : 'NO FACE'}</div>
      <p className="validation">{status?.validation ?? 'Starting camera'}</p>
      {(error ?? status?.error) && <p className="error">{error ?? status?.error}</p>}
      <button type="button" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

function GameScreen({
  camera,
  onChangeCamera
}: {
  camera: Camera
  onChangeCamera: () => void
}): React.JSX.Element {
  const [session] = useState(() => createSessionMachine())
  const [sessionState, setSessionState] = useState<SessionState>(() => session.getState())

  // Active status listener refs
  const sampleReceiverRef = useRef<
    ((scores: ExpressionScores, validationCode: number) => void) | null
  >(null)
  const roundEventsRef = useRef<{
    onExpression: (scores: ExpressionScores, ts: number) => void
    onPulse: (sample: VitalSample, ts: number) => void
    onBreathing: (sample: VitalSample, ts: number) => void
    onValidation: (code: number, ts: number) => void
    onTalking: (detected: boolean, ts: number) => void
  } | null>(null)

  const sync = (): void => {
    setSessionState(session.getState())
  }

  // Subscribe to face:status events
  useEffect(() => {
    const off = window.api.onFaceStatus((status: FaceStatus) => {
      const now = Date.now()
      if (status.expressions) {
        sampleReceiverRef.current?.(status.expressions as ExpressionScores, status.validationCode)
        roundEventsRef.current?.onExpression(status.expressions as ExpressionScores, now)
      }
      if (status.pulse) {
        roundEventsRef.current?.onPulse(status.pulse, now)
      }
      if (status.breathing) {
        roundEventsRef.current?.onBreathing(status.breathing, now)
      }
      if (status.validationCode !== undefined) {
        roundEventsRef.current?.onValidation(status.validationCode, now)
      }
      if (status.talking !== undefined) {
        roundEventsRef.current?.onTalking(status.talking, now)
      }
    })

    return () => {
      off()
      window.api.stopFace()
    }
  }, [])

  const startCamera = async (): Promise<void> => {
    await window.api.startFace(camera.id)
  }

  const stopCamera = async (): Promise<void> => {
    await window.api.stopFace()
  }

  // Lobby Phase
  if (sessionState.phase === 'lobby') {
    return (
      <LobbyScreen
        players={sessionState.players}
        onAddPlayer={(name) => {
          const ok = session.addPlayer(name)
          if (ok) sync()
          return ok
        }}
        onRemovePlayer={(name) => {
          session.removePlayer(name)
          sync()
        }}
        onStart={() => {
          session.proceedToConsent()
          sync()
        }}
        onBackToCamera={onChangeCamera}
      />
    )
  }

  // Consent Phase
  if (sessionState.phase === 'consent') {
    return (
      <ConsentScreen
        players={sessionState.players}
        onConfirmConsent={() => {
          session.confirmConsent()
          sync()
        }}
        onBackToLobby={() => {
          session.resetToLobby()
          sync()
        }}
      />
    )
  }

  // Ready Player Phase
  if (sessionState.phase === 'ready_player') {
    return (
      <ReadyPlayerScreen
        playerName={sessionState.currentPlayerName ?? 'Player'}
        playerIndex={sessionState.currentPlayerIndex}
        totalPlayers={sessionState.players.length}
        lap={sessionState.lap}
        onStartCalibration={async () => {
          await startCamera()
          session.startCalibration()
          sync()
        }}
      />
    )
  }

  // Calibration Phase
  if (sessionState.phase === 'calibrating') {
    return (
      <CalibrationScreen
        playerName={sessionState.currentPlayerName ?? 'Player'}
        onCalibrated={(baseline) => {
          session.calibrationCompleted(baseline)
          sync()
        }}
        onCancel={async () => {
          await stopCamera()
          session.resetToLobby()
          sync()
        }}
        registerSampleReceiver={(fn) => {
          sampleReceiverRef.current = fn
          return () => {
            sampleReceiverRef.current = null
          }
        }}
      />
    )
  }

  // Round Phase
  if (sessionState.phase === 'round' && sessionState.currentBaseline) {
    return (
      <RoundScreen
        playerName={sessionState.currentPlayerName ?? 'Player'}
        baseline={sessionState.currentBaseline}
        onRoundFinished={async (result) => {
          await stopCamera()
          session.roundCompleted(result)
          sync()
        }}
        onAbort={async () => {
          await stopCamera()
          session.resetToLobby()
          sync()
        }}
        registerRoundEvents={(handlers) => {
          roundEventsRef.current = handlers
          return () => {
            roundEventsRef.current = null
          }
        }}
      />
    )
  }

  // Replay Phase
  if (sessionState.phase === 'replay') {
    const currentResult: PlayerRoundResult = sessionState.results[
      sessionState.currentPlayerName ?? ''
    ] ?? {
      playerName: sessionState.currentPlayerName ?? 'Player',
      totalCracks: 0,
      firstCrackMs: null,
      cracks: [],
      spokeEvents: [],
      faceLossTotalMs: 0,
      voided: false
    }

    const isLast = sessionState.currentPlayerIndex + 1 >= sessionState.players.length

    return (
      <ReplayScreen
        result={currentResult}
        isLastPlayerInLap={isLast}
        onNext={() => {
          session.nextPlayerOrLeaderboard()
          sync()
        }}
      />
    )
  }

  // Leaderboard Phase
  if (sessionState.phase === 'leaderboard') {
    return (
      <LeaderboardScreen
        lap={sessionState.lap}
        rankings={session.getRankings()}
        onRematch={() => {
          session.rematch()
          sync()
        }}
        onNewSession={() => {
          session.resetToLobby()
          sync()
        }}
      />
    )
  }

  return <div className="panel">Loading game…</div>
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('loading')
  const [camera, setCamera] = useState<Camera | null>(null)

  useEffect(() => {
    window.api.keyStatus().then(({ source }) => setScreen(source ? 'camera' : 'key'))
  }, [])

  return (
    <main>
      <header>Poker Face</header>
      {screen === 'loading' && <div className="panel">Loading…</div>}
      {screen === 'key' && <KeyScreen onSaved={() => setScreen('camera')} />}
      {screen === 'camera' && (
        <CameraScreen
          onChosen={(c) => {
            window.api.chooseCamera(c)
            setCamera(c)
            setScreen('game')
          }}
          onTest={(c) => {
            window.api.chooseCamera(c)
            setCamera(c)
            setScreen('test_camera')
          }}
        />
      )}
      {screen === 'test_camera' && camera && (
        <TestCameraScreen camera={camera} onBack={() => setScreen('camera')} />
      )}
      {screen === 'game' && camera && (
        <GameScreen camera={camera} onChangeCamera={() => setScreen('camera')} />
      )}
    </main>
  )
}

export default App
