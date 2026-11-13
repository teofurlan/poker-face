export interface CameraInfo {
  id: string
  name: string
}

// Windows device ids can change between sessions, so fall back to the camera name.
export function pickRememberedCamera(
  cameras: CameraInfo[],
  remembered: CameraInfo | null
): CameraInfo | null {
  if (!remembered) return null
  return (
    cameras.find((c) => c.id === remembered.id) ??
    cameras.find((c) => c.name === remembered.name) ??
    null
  )
}
