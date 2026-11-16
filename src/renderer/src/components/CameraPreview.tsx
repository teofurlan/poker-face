import { useEffect, useRef } from 'react'
import { useFaceSource } from '../face/faceContext'

// Small mirrored live view of the camera the SDK is reading, pinned to a screen corner.
// The video element is driven directly (no React state): the stream is attached on every
// change and the box is hidden while there is no stream.
export function CameraPreview(): React.JSX.Element {
  const { source, demo } = useFaceSource()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const off = source.onStream((stream) => {
      video.srcObject = stream
      video.hidden = stream === null
    })
    return () => {
      off()
      video.srcObject = null
    }
  }, [source])

  if (demo) {
    return (
      <div
        className="camera-preview camera-preview-recorded"
        role="img"
        aria-label="Recorded session, no camera"
      >
        Recorded session
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className="camera-preview"
      aria-label="Camera preview"
      muted
      autoPlay
      playsInline
      hidden
    />
  )
}
