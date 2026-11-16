import { useEffect, useRef } from 'react'
import { face } from '../face/face'

// Small mirrored live view of the camera the SDK is reading, pinned to a screen corner.
// The video element is driven directly (no React state): the stream is attached on every
// change and the box is hidden while there is no stream.
export function CameraPreview(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const off = face.onStream((stream) => {
      video.srcObject = stream
      video.hidden = stream === null
    })
    return () => {
      off()
      video.srcObject = null
    }
  }, [])

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
