import type { PokerFaceApi } from './index'

declare global {
  interface Window {
    api: PokerFaceApi
  }
}
