import { createContext, useContext } from 'react'
import { face } from './face'
import type { FaceSource } from './faceSource'

// Which face source the screens read: the live camera + SDK (default), or the recorded demo.
export interface FaceContextValue {
  source: FaceSource
  demo: boolean
}

export const FaceContext = createContext<FaceContextValue>({ source: face, demo: false })

export function useFaceSource(): FaceContextValue {
  return useContext(FaceContext)
}
