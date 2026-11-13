import { describe, it, expect } from 'vitest'
import { createSessionMachine } from './sessionMachine'

describe('createSessionMachine', () => {
  it('manages 1 to 6 players in entry order', () => {
    const session = createSessionMachine()
    expect(session.getState().phase).toBe('lobby')
    expect(session.getState().players).toEqual([])

    session.addPlayer('Alice')
    session.addPlayer('Bob')
    expect(session.getState().players).toEqual(['Alice', 'Bob'])

    // Remove player
    session.removePlayer('Alice')
    expect(session.getState().players).toEqual(['Bob'])

    // Max 6 players limit
    session.addPlayer('P1')
    session.addPlayer('P2')
    session.addPlayer('P3')
    session.addPlayer('P4')
    session.addPlayer('P5')
    const addedSeventh = session.addPlayer('P6') // would be 7th
    expect(addedSeventh).toBe(false)
    expect(session.getState().players.length).toBe(6)
  })

  it('moves from lobby to consent to ready_player', () => {
    const session = createSessionMachine()
    session.addPlayer('Alice')
    session.addPlayer('Bob')

    // Cannot start without players
    const toConsent = session.proceedToConsent()
    expect(toConsent).toBe(true)
    expect(session.getState().phase).toBe('consent')

    // Confirm consent for all
    session.confirmConsent()
    expect(session.getState().phase).toBe('ready_player')
    expect(session.getState().currentPlayerIndex).toBe(0)
    expect(session.getState().currentPlayerName).toBe('Alice')
  })

  it('advances through calibration, round, replay and next player', () => {
    const session = createSessionMachine()
    session.addPlayer('Alice')
    session.addPlayer('Bob')
    session.proceedToConsent()
    session.confirmConsent()

    // Start calibration for Alice
    session.startCalibration()
    expect(session.getState().phase).toBe('calibrating')

    // Complete calibration
    session.calibrationCompleted({
      ANGRY: 0,
      CONTEMPT: 0,
      DISGUST: 0,
      FEAR: 0,
      HAPPY: 0,
      NEUTRAL: 80,
      SAD: 20,
      SURPRISE: 0
    })
    expect(session.getState().phase).toBe('round')

    // Complete round for Alice (1 crack, first crack at 15000 ms)
    session.roundCompleted({
      totalCracks: 1,
      firstCrackMs: 15000,
      cracks: [{ startMs: 15000, endMs: 16000, peakVariation: 55 }],
      spokeEvents: [22000],
      faceLossTotalMs: 1000,
      voided: false
    })
    expect(session.getState().phase).toBe('replay')

    // Proceed from replay to next player (Bob)
    session.nextPlayerOrLeaderboard()
    expect(session.getState().phase).toBe('ready_player')
    expect(session.getState().currentPlayerIndex).toBe(1)
    expect(session.getState().currentPlayerName).toBe('Bob')

    // Bob's turn
    session.startCalibration()
    session.calibrationCompleted({
      ANGRY: 0,
      CONTEMPT: 0,
      DISGUST: 0,
      FEAR: 0,
      HAPPY: 0,
      NEUTRAL: 90,
      SAD: 10,
      SURPRISE: 0
    })
    // Bob has 0 cracks
    session.roundCompleted({
      totalCracks: 0,
      firstCrackMs: null,
      cracks: [],
      spokeEvents: [],
      faceLossTotalMs: 0,
      voided: false
    })
    expect(session.getState().phase).toBe('replay')

    // After Bob (last player in lap), proceeds to leaderboard
    session.nextPlayerOrLeaderboard()
    expect(session.getState().phase).toBe('leaderboard')

    const rankings = session.getRankings()
    expect(rankings.length).toBe(2)
    // Bob should be 1st (0 cracks), Alice 2nd (1 crack)
    expect(rankings[0].playerName).toBe('Bob')
    expect(rankings[0].rank).toBe(1)
    expect(rankings[1].playerName).toBe('Alice')
    expect(rankings[1].rank).toBe(2)
  })

  it('ranks players with tiebreaker: longer time to first crack wins', () => {
    const session = createSessionMachine()
    session.addPlayer('Alice')
    session.addPlayer('Bob')
    session.proceedToConsent()
    session.confirmConsent()

    // Alice: 1 crack at 10s
    session.startCalibration()
    session.calibrationCompleted({
      ANGRY: 0,
      CONTEMPT: 0,
      DISGUST: 0,
      FEAR: 0,
      HAPPY: 0,
      NEUTRAL: 80,
      SAD: 20,
      SURPRISE: 0
    })
    session.roundCompleted({
      totalCracks: 1,
      firstCrackMs: 10000,
      cracks: [{ startMs: 10000, endMs: 11000, peakVariation: 45 }],
      spokeEvents: [],
      faceLossTotalMs: 0,
      voided: false
    })
    session.nextPlayerOrLeaderboard()

    // Bob: 1 crack at 35s (held out longer!)
    session.startCalibration()
    session.calibrationCompleted({
      ANGRY: 0,
      CONTEMPT: 0,
      DISGUST: 0,
      FEAR: 0,
      HAPPY: 0,
      NEUTRAL: 80,
      SAD: 20,
      SURPRISE: 0
    })
    session.roundCompleted({
      totalCracks: 1,
      firstCrackMs: 35000,
      cracks: [{ startMs: 35000, endMs: 36000, peakVariation: 45 }],
      spokeEvents: [],
      faceLossTotalMs: 0,
      voided: false
    })
    session.nextPlayerOrLeaderboard()

    expect(session.getState().phase).toBe('leaderboard')
    const rankings = session.getRankings()
    // Both have 1 crack, but Bob lasted 35s vs Alice's 10s, so Bob is #1
    expect(rankings[0].playerName).toBe('Bob')
    expect(rankings[1].playerName).toBe('Alice')
  })

  it('handles rematch by keeping player names and resetting scores', () => {
    const session = createSessionMachine()
    session.addPlayer('Alice')
    session.addPlayer('Bob')
    session.proceedToConsent()
    session.confirmConsent()

    // Skip to leaderboard with dummy results
    session.startCalibration()
    session.calibrationCompleted({
      ANGRY: 0,
      CONTEMPT: 0,
      DISGUST: 0,
      FEAR: 0,
      HAPPY: 0,
      NEUTRAL: 80,
      SAD: 20,
      SURPRISE: 0
    })
    session.roundCompleted({
      totalCracks: 0,
      firstCrackMs: null,
      cracks: [],
      spokeEvents: [],
      faceLossTotalMs: 0,
      voided: false
    })
    session.nextPlayerOrLeaderboard()
    session.startCalibration()
    session.calibrationCompleted({
      ANGRY: 0,
      CONTEMPT: 0,
      DISGUST: 0,
      FEAR: 0,
      HAPPY: 0,
      NEUTRAL: 80,
      SAD: 20,
      SURPRISE: 0
    })
    session.roundCompleted({
      totalCracks: 0,
      firstCrackMs: null,
      cracks: [],
      spokeEvents: [],
      faceLossTotalMs: 0,
      voided: false
    })
    session.nextPlayerOrLeaderboard()

    expect(session.getState().phase).toBe('leaderboard')

    // Trigger rematch
    session.rematch()
    expect(session.getState().phase).toBe('ready_player')
    expect(session.getState().currentPlayerIndex).toBe(0)
    expect(session.getState().currentPlayerName).toBe('Alice')
    expect(session.getState().lap).toBe(2)
    expect(session.getState().results).toEqual({})
  })
})
