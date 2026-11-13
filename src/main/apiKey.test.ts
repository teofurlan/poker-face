import { describe, expect, it } from 'vitest'
import { createKeyStore, type KeyStoreDeps } from './apiKey'

function fakeDeps(
  overrides: Partial<KeyStoreDeps> = {}
): KeyStoreDeps & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>()
  return {
    files,
    env: {},
    filePath: 'C:/userData/api-key.bin',
    encryptionAvailable: () => true,
    encrypt: (text) => Buffer.from(`enc:${text}`),
    decrypt: (buf) => buf.toString().replace(/^enc:/, ''),
    readFile: (p) => files.get(p) ?? null,
    writeFile: (p, data) => void files.set(p, data),
    ...overrides
  }
}

describe('key store', () => {
  it('uses PRESAGE_API_KEY from the environment and skips the screen', () => {
    const deps = fakeDeps({ env: { PRESAGE_API_KEY: 'env-key' } })
    deps.files.set(deps.filePath, Buffer.from('enc:stored-key'))
    expect(createKeyStore(deps).resolve()).toEqual({ key: 'env-key', source: 'env' })
  })

  it('ignores a blank environment variable', () => {
    const deps = fakeDeps({ env: { PRESAGE_API_KEY: '  ' } })
    expect(createKeyStore(deps).resolve()).toEqual({ key: null, source: null })
  })

  it('reads the key saved on this computer when no env var is set', () => {
    const deps = fakeDeps()
    deps.files.set(deps.filePath, Buffer.from('enc:stored-key'))
    expect(createKeyStore(deps).resolve()).toEqual({ key: 'stored-key', source: 'stored' })
  })

  it('asks for the key when nothing is stored', () => {
    expect(createKeyStore(fakeDeps()).resolve()).toEqual({ key: null, source: null })
  })

  it('saves the key encrypted, never as plain text', () => {
    const deps = fakeDeps()
    const store = createKeyStore(deps)
    expect(store.save('  my-key  ')).toEqual({ ok: true })
    expect(deps.files.get(deps.filePath)?.toString()).toBe('enc:my-key')
    expect(store.resolve()).toEqual({ key: 'my-key', source: 'stored' })
  })

  it('rejects an empty key and leaves the stored key unchanged', () => {
    const deps = fakeDeps()
    deps.files.set(deps.filePath, Buffer.from('enc:old'))
    expect(createKeyStore(deps).save('   ')).toEqual({
      ok: false,
      error: 'Enter your Presage API key.'
    })
    expect(deps.files.get(deps.filePath)?.toString()).toBe('enc:old')
  })

  it('refuses to save when encryption is unavailable and writes nothing', () => {
    const deps = fakeDeps({ encryptionAvailable: () => false })
    expect(createKeyStore(deps).save('my-key')).toEqual({
      ok: false,
      error:
        'This computer cannot encrypt the key. Set the PRESAGE_API_KEY environment variable instead.'
    })
    expect(deps.files.size).toBe(0)
  })

  it('treats an unreadable stored key as missing', () => {
    const deps = fakeDeps({
      decrypt: () => {
        throw new Error('bad data')
      }
    })
    deps.files.set(deps.filePath, Buffer.from('garbage'))
    expect(createKeyStore(deps).resolve()).toEqual({ key: null, source: null })
  })
})
