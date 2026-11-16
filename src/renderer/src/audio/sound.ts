// App-wide sound: one engine, one remembered mute preference, plus a snapshot-diff helper.
import { useSyncExternalStore } from 'react'
import { cuesBetween, type CueSnapshot } from './cues'
import { createSoundEngine, type AudioContextLike } from './engine'
import { createMutePreference } from './preference'

const storage = typeof localStorage === 'undefined' ? null : localStorage
const preference = createMutePreference(storage)

export const sound = createSoundEngine({
  createContext: () =>
    typeof AudioContext === 'undefined' ? null : (new AudioContext() as AudioContextLike)
})
sound.setMuted(preference.isMuted())
preference.subscribe(() => sound.setMuted(preference.isMuted()))

if (typeof window !== 'undefined') {
  // Browsers/Electron may start the context suspended until a user gesture.
  const unlock = (): void => sound.unlock()
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

export function setSoundMuted(muted: boolean): void {
  preference.setMuted(muted)
}

export function useSoundMuted(): boolean {
  return useSyncExternalStore(preference.subscribe, preference.isMuted)
}

/** Round cue state: holds the live round values and emits cues on each change. */
export function createRoundCues(): {
  update(patch: { secondsLeft?: number; totalCracks?: number; isCracking?: boolean }): void
  isFinished(): boolean
  reset(): void
} {
  const initial = { secondsLeft: 60, totalCracks: 0, isCracking: false }
  let live = initial
  const ref: { current: CueSnapshot | null } = { current: { phase: 'round', ...live } }
  return {
    update(patch) {
      live = { ...live, ...patch }
      emitSnapshot(ref, { phase: 'round', ...live })
    },
    isFinished: () => live.secondsLeft === 0,
    reset() {
      live = initial
      ref.current = { phase: 'round', ...live }
    }
  }
}

/** Diff against the last snapshot held by the caller's ref and play the resulting cues. */
export function emitSnapshot(ref: { current: CueSnapshot | null }, next: CueSnapshot): void {
  const prev = ref.current
  ref.current = next
  for (const cue of cuesBetween(prev, next)) sound.play(cue)
}
