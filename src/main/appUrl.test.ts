import { describe, expect, it } from 'vitest'
import { createAppUrlMatcher } from './appUrl'

const winIndex =
  'C:\\Users\\Teo Furlan\\AppData\\Local\\Programs\\Poker Face\\resources\\app\\out\\renderer\\index.html'
const winIndexUrl =
  'file:///C:/Users/Teo%20Furlan/AppData/Local/Programs/Poker%20Face/resources/app/out/renderer/index.html'
const winIndexLowerDriveUrl =
  'file:///c:/Users/Teo%20Furlan/AppData/Local/Programs/Poker%20Face/resources/app/out/renderer/index.html'

describe('createAppUrlMatcher', () => {
  it('allows the dev server origin and rejects other origins in dev mode', () => {
    const isAppUrl = createAppUrlMatcher({
      isDev: true,
      devUrl: 'http://localhost:5173',
      rendererIndexPath: winIndex,
      platform: 'win32'
    })

    expect(isAppUrl('http://localhost:5173/')).toBe(true)
    expect(isAppUrl('http://localhost:5173/index.html?x=1')).toBe(true)
    expect(isAppUrl('http://localhost:5174/')).toBe(false)
    expect(isAppUrl('https://localhost:5173/')).toBe(false)
    expect(isAppUrl('https://evil.example/')).toBe(false)
    expect(isAppUrl(winIndexUrl)).toBe(false)
  })

  it('ignores devUrl when packaged (isDev: false) and allows only the packaged index.html', () => {
    const isAppUrl = createAppUrlMatcher({
      isDev: false,
      devUrl: 'http://localhost:5173',
      rendererIndexPath: winIndex,
      platform: 'win32'
    })

    expect(isAppUrl('http://localhost:5173/')).toBe(false)
    expect(isAppUrl(winIndexUrl)).toBe(true)
  })

  it('handles Windows install paths with spaces and drive-letter/path case differences', () => {
    const isAppUrl = createAppUrlMatcher({
      isDev: false,
      rendererIndexPath: winIndex,
      platform: 'win32'
    })

    expect(isAppUrl(winIndexUrl)).toBe(true)
    expect(isAppUrl(winIndexLowerDriveUrl)).toBe(true)
    expect(
      isAppUrl(
        'file:///C:/Users/Teo Furlan/AppData/Local/Programs/Poker Face/resources/app/out/renderer/index.html'
      )
    ).toBe(true)
  })

  it('rejects sibling files, parent traversal, non-file schemes and malformed URLs', () => {
    const isAppUrl = createAppUrlMatcher({
      isDev: false,
      rendererIndexPath: winIndex,
      platform: 'win32'
    })

    expect(
      isAppUrl(
        'file:///C:/Users/Teo%20Furlan/AppData/Local/Programs/Poker%20Face/resources/app/out/renderer/other.html'
      )
    ).toBe(false)
    expect(
      isAppUrl(
        'file:///C:/Users/Teo%20Furlan/AppData/Local/Programs/Poker%20Face/resources/app/out/renderer/../preload/index.js'
      )
    ).toBe(false)
    expect(isAppUrl('https://example.com/index.html')).toBe(false)
    expect(isAppUrl('data:text/html,<h1>hi</h1>')).toBe(false)
    expect(isAppUrl('javascript:alert(1)')).toBe(false)
    expect(isAppUrl('')).toBe(false)
    expect(isAppUrl('not-a-valid-url')).toBe(false)
  })
})
