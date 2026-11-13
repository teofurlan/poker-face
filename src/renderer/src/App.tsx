import { useEffect, useState } from 'react'
import type { FaceStatus } from '../../preload'

type Camera = { id: string; name: string }
type Screen = 'loading' | 'key' | 'camera' | 'live'

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

function CameraScreen({ onChosen }: { onChosen: (camera: Camera) => void }): React.JSX.Element {
  const [cameras, setCameras] = useState<Camera[] | null>(null)
  const [selected, setSelected] = useState<string>('')
  useEffect(() => {
    window.api.listCameras().then(({ cameras, selectedId }) => {
      setCameras(cameras)
      setSelected(selectedId ?? cameras[0]?.id ?? '')
    })
  }, [])
  if (!cameras) return <div className="panel">Looking for cameras…</div>
  if (!cameras.length)
    return (
      <div className="panel">
        <h1>No camera found</h1>
        <p className="error">Connect a camera and restart Poker Face.</p>
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
      <button disabled={!chosen} onClick={() => chosen && onChosen(chosen)}>
        Use this camera
      </button>
    </div>
  )
}

function LiveScreen({ camera, onBack }: { camera: Camera; onBack: () => void }): React.JSX.Element {
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
      <button onClick={onBack}>Stop</button>
    </div>
  )
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
            setScreen('live')
          }}
        />
      )}
      {screen === 'live' && camera && (
        <LiveScreen camera={camera} onBack={() => setScreen('camera')} />
      )}
    </main>
  )
}

export default App
