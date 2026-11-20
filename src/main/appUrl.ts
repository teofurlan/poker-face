import { fileURLToPath, pathToFileURL } from 'node:url'

export interface AppUrlMatcherOptions {
  isDev: boolean
  devUrl?: string
  rendererIndexPath: string
  platform?: NodeJS.Platform
}

function parseOrigin(url?: string): string | null {
  if (!url) return null
  try {
    const origin = new URL(url).origin
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

// The app's own page: the dev server origin in development, the packaged index.html otherwise.
export function createAppUrlMatcher(options: AppUrlMatcherOptions): (url: string) => boolean {
  const platform = options.platform ?? process.platform
  const rendererIndexUrl = pathToFileURL(options.rendererIndexPath).href
  const devOrigin = options.isDev ? parseOrigin(options.devUrl) : null

  return (url: string): boolean => {
    try {
      const parsed = new URL(url)
      if (devOrigin) return parsed.origin === devOrigin
      if (parsed.protocol !== 'file:') return false
      const href = pathToFileURL(fileURLToPath(parsed)).href
      // Windows paths are case-insensitive and Chromium may report a different drive-letter case.
      return platform === 'win32'
        ? href.toLowerCase() === rendererIndexUrl.toLowerCase()
        : href === rendererIndexUrl
    } catch {
      return false
    }
  }
}
