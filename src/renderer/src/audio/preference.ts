// Remembered mute choice. Storage is injected so it is testable; default is sound on.

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface MutePreference {
  isMuted(): boolean
  setMuted(muted: boolean): void
  subscribe(listener: () => void): () => void
}

export const MUTE_STORAGE_KEY = 'poker-face:sound-muted'

export function createMutePreference(storage: KeyValueStorage | null): MutePreference {
  let muted = false
  try {
    muted = storage?.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    muted = false
  }
  const listeners = new Set<() => void>()
  return {
    isMuted: () => muted,
    setMuted(next) {
      if (next === muted) return
      muted = next
      try {
        storage?.setItem(MUTE_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Not persisted; still applies for this session.
      }
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
