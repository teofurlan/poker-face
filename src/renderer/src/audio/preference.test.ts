import { describe, expect, it } from 'vitest'
import { createMutePreference, type KeyValueStorage } from './preference'

const memory = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v)
  }
}

describe('createMutePreference', () => {
  it('defaults to sound on', () => {
    expect(createMutePreference(memory()).isMuted()).toBe(false)
  })
  it('persists and survives a reload', () => {
    const storage = memory()
    const first = createMutePreference(storage)
    first.setMuted(true)
    expect(first.isMuted()).toBe(true)
    expect(createMutePreference(storage).isMuted()).toBe(true)
    first.setMuted(false)
    expect(createMutePreference(storage).isMuted()).toBe(false)
  })
  it('notifies subscribers and supports unsubscribe', () => {
    const pref = createMutePreference(memory())
    const seen: boolean[] = []
    const off = pref.subscribe(() => seen.push(pref.isMuted()))
    pref.setMuted(true)
    off()
    pref.setMuted(false)
    expect(seen).toEqual([true])
  })
  it('falls back to sound on when storage is missing, throws or holds junk', () => {
    expect(createMutePreference(null).isMuted()).toBe(false)
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      }
    }
    const p = createMutePreference(broken)
    expect(p.isMuted()).toBe(false)
    p.setMuted(true)
    expect(p.isMuted()).toBe(true)
    const junk = memory()
    junk.setItem('poker-face:sound-muted', 'banana')
    expect(createMutePreference(junk).isMuted()).toBe(false)
  })
})
