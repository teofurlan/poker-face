import type { CrackEvent, ExpressionScores } from './crackDetector'

export type SessionPhase =
  'lobby' | 'consent' | 'ready_player' | 'calibrating' | 'round' | 'replay' | 'leaderboard'

export interface PlayerRoundResult {
  playerName: string
  totalCracks: number
  firstCrackMs: number | null
  cracks: CrackEvent[]
  spokeEvents: number[]
  faceLossTotalMs: number
  voided: boolean
}

export interface PlayerRanking {
  playerName: string
  rank: number
  totalCracks: number
  firstCrackMs: number | null
  voided: boolean
}

export interface SessionState {
  phase: SessionPhase
  players: string[]
  currentPlayerIndex: number
  currentPlayerName: string | null
  lap: number
  results: Record<string, PlayerRoundResult>
  currentBaseline: ExpressionScores | null
}

export function createSessionMachine(): {
  addPlayer: (name: string) => boolean
  removePlayer: (name: string) => void
  proceedToConsent: () => boolean
  confirmConsent: () => void
  startCalibration: () => void
  calibrationCompleted: (baseline: ExpressionScores) => void
  roundCompleted: (result: Omit<PlayerRoundResult, 'playerName'>) => void
  nextPlayerOrLeaderboard: () => void
  getRankings: () => PlayerRanking[]
  rematch: () => void
  resetToLobby: () => void
  getState: () => SessionState
} {
  let phase: SessionPhase = 'lobby'
  const players: string[] = []
  let currentPlayerIndex = 0
  let lap = 1
  let results: Record<string, PlayerRoundResult> = {}
  let currentBaseline: ExpressionScores | null = null

  function getState(): SessionState {
    return {
      phase,
      players: [...players],
      currentPlayerIndex,
      currentPlayerName: players[currentPlayerIndex] ?? null,
      lap,
      results: { ...results },
      currentBaseline
    }
  }

  function addPlayer(name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed || players.length >= 6 || players.includes(trimmed)) {
      return false
    }
    players.push(trimmed)
    return true
  }

  function removePlayer(name: string): void {
    const index = players.indexOf(name)
    if (index !== -1) {
      players.splice(index, 1)
    }
  }

  function proceedToConsent(): boolean {
    if (players.length === 0) return false
    phase = 'consent'
    return true
  }

  function confirmConsent(): void {
    currentPlayerIndex = 0
    phase = 'ready_player'
  }

  function startCalibration(): void {
    phase = 'calibrating'
  }

  function calibrationCompleted(baseline: ExpressionScores): void {
    currentBaseline = baseline
    phase = 'round'
  }

  function roundCompleted(result: Omit<PlayerRoundResult, 'playerName'>): void {
    const playerName = players[currentPlayerIndex]
    if (playerName) {
      results[playerName] = {
        ...result,
        playerName
      }
    }
    phase = 'replay'
  }

  function nextPlayerOrLeaderboard(): void {
    if (currentPlayerIndex + 1 < players.length) {
      currentPlayerIndex += 1
      currentBaseline = null
      phase = 'ready_player'
    } else {
      phase = 'leaderboard'
    }
  }

  function getRankings(): PlayerRanking[] {
    const list = players.map((p) => {
      const res = results[p]
      return {
        playerName: p,
        totalCracks: res?.totalCracks ?? 0,
        firstCrackMs: res?.firstCrackMs ?? null,
        voided: res?.voided ?? false
      }
    })

    list.sort((a, b) => {
      // 1. Non-voided beats voided
      if (a.voided !== b.voided) return a.voided ? 1 : -1

      // 2. Fewest cracks wins
      if (a.totalCracks !== b.totalCracks) {
        return a.totalCracks - b.totalCracks
      }

      // 3. Tiebreaker: longer time to first crack wins
      // (null means never cracked -> best possible outcome)
      if (a.firstCrackMs === null && b.firstCrackMs !== null) return -1
      if (b.firstCrackMs === null && a.firstCrackMs !== null) return 1
      if (a.firstCrackMs !== null && b.firstCrackMs !== null) {
        return b.firstCrackMs - a.firstCrackMs
      }

      return 0
    })

    return list.map((item, index) => ({
      ...item,
      rank: index + 1
    }))
  }

  function rematch(): void {
    lap += 1
    results = {}
    currentPlayerIndex = 0
    currentBaseline = null
    phase = 'ready_player'
  }

  function resetToLobby(): void {
    phase = 'lobby'
    players.length = 0
    currentPlayerIndex = 0
    lap = 1
    results = {}
    currentBaseline = null
  }

  return {
    addPlayer,
    removePlayer,
    proceedToConsent,
    confirmConsent,
    startCalibration,
    calibrationCompleted,
    roundCompleted,
    nextPlayerOrLeaderboard,
    getRankings,
    rematch,
    resetToLobby,
    getState
  }
}
