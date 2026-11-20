import { useEffect, useMemo, useRef, useState } from 'react'
import { face, listCameras } from './face/face'
import { FaceContext, useFaceSource } from './face/faceContext'
import type { FaceStatus } from './face/faceSession'
import recording from './demo/recording.json'
import { createRecordedFace, type Recording } from './demo/recordedFace'
import { DemoIntroScreen } from './components/DemoIntroScreen'
import { CalibrationScreen, type CalibrationStatus } from './components/CalibrationScreen'
import { Bug } from './components/Chrome'
import { CameraPreview } from './components/CameraPreview'
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
type Screen = 'loading' | 'key' | 'camera' | 'test_camera' | 'game' | 'demo_intro' | 'demo'

const DEMO_CAMERA: Camera = { id: 'demo', name: 'Recorded session' }
const DEMO_PLAYER = 'Demo player'

// A one-player session already past lobby and consent, for the demo.
function createDemoSession(): ReturnType<typeof createSessionMachine> {
  const machine = createSessionMachine()
  machine.addPlayer(DEMO_PLAYER)
  machine.proceedToConsent()
  machine.confirmConsent()
  return machine
}

function KeyScreen({
  onSaved,
  onDemo
}: {
  onSaved: () => void
  onDemo: () => void
}): React.JSX.Element {
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
      <button type="submit" className="primary-btn">
        Save key
      </button>
      <button type="button" className="secondary-btn" onClick={onDemo}>
        Try a demo round
      </button>
      <Bug context="Setup · API key" />
    </form>
  )
}

function CameraScreen({
  onChosen,
  onTest,
  onDemo
}: {
  onChosen: (camera: Camera) => void
  onTest: (camera: Camera) => void
  onDemo: () => void
}): React.JSX.Element {
  const [cameras, setCameras] = useState<Camera[] | null>(null)
  const [selected, setSelected] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    listCameras()
      .then(async (cameras) => {
        const selectedId = await window.api.rememberedCamera(cameras)
        setCameras(cameras)
        setSelected(selectedId ?? cameras[0]?.id ?? '')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setCameras([])
      })
  }, [])
  if (!cameras)
    return (
      <div className="panel">
        <h1>Looking for cameras…</h1>
        <Bug context="Setup · camera" />
      </div>
    )
  if (!cameras.length)
    return (
      <div className="panel">
        <h1>No camera found</h1>
        <p className="error">{error ?? 'Connect a camera and restart Poker Face.'}</p>
        <button type="button" className="secondary-btn" onClick={onDemo}>
          Try a demo round
        </button>
        <Bug context="Setup · camera" />
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
        <button type="button" className="secondary-btn" onClick={onDemo}>
          Try a demo round
        </button>
      </div>
      <Bug context="Setup · camera" />
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
  const { source } = useFaceSource()
  const [status, setStatus] = useState<FaceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const off = source.onStatus(setStatus)
    source.start(camera.id).then((r) => {
      if (!r.ok) setError(r.error)
    })
    return () => {
      off()
      source.stop()
    }
  }, [camera.id, source])
  const faceSeen = status?.faceDetected
  return (
    <div className="panel test-camera-panel">
      <p className="muted">Testing camera: {camera.name}</p>
      <div className={`face ${faceSeen ? 'on' : 'off'}`}>{faceSeen ? 'FACE' : 'NO FACE'}</div>
      <p className="validation">{status?.validation ?? 'Starting camera'}</p>
      {(error ?? status?.error) && <p className="error">{error ?? status?.error}</p>}
      <button type="button" className="secondary-btn" onClick={onBack}>
        Back
      </button>
      <CameraPreview />
      <Bug context="Setup · camera test" />
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
  const { source: faceSource, demo } = useFaceSource()
  const [session] = useState(() => (demo ? createDemoSession() : createSessionMachine()))
  const [sessionState, setSessionState] = useState<SessionState>(() => session.getState())
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Active status listener refs
  const statusReceiverRef = useRef<((status: CalibrationStatus) => void) | null>(null)
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
    const off = faceSource.onStatus((status: FaceStatus) => {
      const now = Date.now()
      statusReceiverRef.current?.({
        validationCode: status.validationCode,
        expressions: status.expressions as ExpressionScores | undefined,
        error: status.error
      })
      if (status.expressions) {
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
      faceSource.stop()
    }
  }, [faceSource])

  const startCamera = async (): Promise<void> => {
    setCameraError(null)
    const result = await faceSource.start(camera.id)
    if (!result.ok) setCameraError(result.error)
  }

  const stopCamera = async (): Promise<void> => {
    await faceSource.stop()
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
      <>
        <CalibrationScreen
          playerName={sessionState.currentPlayerName ?? 'Player'}
          onCalibrated={(baseline) => {
            session.calibrationCompleted(baseline)
            sync()
          }}
          cameraError={cameraError}
          onCancel={async () => {
            await stopCamera()
            setCameraError(null)
            if (demo) {
              onChangeCamera()
              return
            }
            session.resetToLobby()
            sync()
          }}
          registerStatusReceiver={(fn) => {
            statusReceiverRef.current = fn
            return () => {
              statusReceiverRef.current = null
            }
          }}
        />
        <CameraPreview />
      </>
    )
  }

  // Round Phase
  if (sessionState.phase === 'round' && sessionState.currentBaseline) {
    return (
      <>
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
            if (demo) {
              onChangeCamera()
              return
            }
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
        <CameraPreview />
      </>
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
          if (demo) {
            onChangeCamera()
            return
          }
          session.resetToLobby()
          sync()
        }}
      />
    )
  }

  return (
    <div className="panel">
      <h1>Loading game…</h1>
      <Bug />
    </div>
  )
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('loading')
  const [camera, setCamera] = useState<Camera | null>(null)
  // Where "Back" from the demo returns to.
  const [demoFrom, setDemoFrom] = useState<'key' | 'camera'>('key')
  const recordedFace = useMemo(() => createRecordedFace({ recording: recording as Recording }), [])
  const inDemo = screen === 'demo_intro' || screen === 'demo'
  const faceContext = useMemo(
    () => (inDemo ? { source: recordedFace, demo: true } : { source: face, demo: false }),
    [inDemo, recordedFace]
  )

  useEffect(() => {
    window.api.keyStatus().then(({ source }) => setScreen(source ? 'camera' : 'key'))
  }, [])

  // Stop any camera session before the window closes, then let the main process close it.
  useEffect(
    () =>
      window.api.onAppClosing(() => {
        face
          .stop()
          .catch(() => undefined)
          .finally(() => window.api.cameraReleased())
      }),
    []
  )

  return (
    <FaceContext.Provider value={faceContext}>
      <main>
        <div className="lamp" aria-hidden="true" />
        {screen === 'loading' && (
          <div className="panel">
            <h1>Loading…</h1>
            <Bug />
          </div>
        )}
        {screen === 'key' && (
          <KeyScreen
            onSaved={() => setScreen('camera')}
            onDemo={() => {
              setDemoFrom('key')
              setScreen('demo_intro')
            }}
          />
        )}
        {screen === 'camera' && (
          <CameraScreen
            onDemo={() => {
              setDemoFrom('camera')
              setScreen('demo_intro')
            }}
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
        {screen === 'demo_intro' && (
          <DemoIntroScreen onStart={() => setScreen('demo')} onBack={() => setScreen(demoFrom)} />
        )}
        {screen === 'demo' && (
          <GameScreen camera={DEMO_CAMERA} onChangeCamera={() => setScreen(demoFrom)} />
        )}
      </main>
    </FaceContext.Provider>
  )
}

export default App
