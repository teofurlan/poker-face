// Where the Presage API key comes from: the PRESAGE_API_KEY environment variable wins,
// otherwise the key saved on this computer, encrypted with Electron safeStorage.
// The key is never bundled into the app.

export type KeySource = 'env' | 'stored'
export type ResolvedKey = { key: string; source: KeySource } | { key: null; source: null }
export type SaveResult = { ok: true } | { ok: false; error: string }

export interface KeyStoreDeps {
  env: Record<string, string | undefined>
  filePath: string
  encryptionAvailable: () => boolean
  encrypt: (text: string) => Buffer
  decrypt: (data: Buffer) => string
  readFile: (path: string) => Buffer | null
  writeFile: (path: string, data: Buffer) => void
}

const NONE: ResolvedKey = { key: null, source: null }

export function createKeyStore(deps: KeyStoreDeps): {
  resolve: () => ResolvedKey
  save: (key: string) => SaveResult
} {
  function resolve(): ResolvedKey {
    const fromEnv = deps.env.PRESAGE_API_KEY?.trim()
    if (fromEnv) return { key: fromEnv, source: 'env' }
    const data = deps.readFile(deps.filePath)
    if (!data) return NONE
    try {
      const key = deps.decrypt(data).trim()
      return key ? { key, source: 'stored' } : NONE
    } catch {
      return NONE
    }
  }

  function save(input: string): SaveResult {
    const key = input.trim()
    if (!key) return { ok: false, error: 'Enter your Presage API key.' }
    if (!deps.encryptionAvailable()) {
      return {
        ok: false,
        error:
          'This computer cannot encrypt the key. Set the PRESAGE_API_KEY environment variable instead.'
      }
    }
    deps.writeFile(deps.filePath, deps.encrypt(key))
    return { ok: true }
  }

  return { resolve, save }
}
