import type { FaceStatus } from './faceSession'

// What the game needs from a face source: the live camera + SDK session, or a recorded one.
export interface FaceSource {
  start(cameraId: string): Promise<{ ok: true } | { ok: false; error: string }>
  stop(): Promise<unknown>
  onStatus(listener: (status: FaceStatus) => void): () => void
  onStream(listener: (stream: MediaStream | null) => void): () => void
}
