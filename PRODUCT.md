# Product

<!-- impeccable:product-schema 1 -->

<!-- Provenance: written by a subagent from the parent's brief, CONTEXT.md and README.md. No interview round with the user took place (no question tool in this run). Items marked [inferred] await the user's confirmation. -->

## Platform

web

## Stack

Existing codebase: Electron + electron-vite + React (renderer in `src/renderer/src`), single fullscreen window.

## Users

- A small group (1 to 6 people) in one room around a single shared screen: a laptop, or the laptop mirrored to a TV. One webcam. Party setting, people standing or sitting several metres from the screen. [inferred: casual, social, not gamers by default]
- Role of the moment: the **Player** (in the hot seat, face on camera, silent) and the **Challengers** (everyone else, trying to make the Player laugh).
- A second audience: DEV challenge judges and viewers of the demo video and post, who judge on use of the technology, usability and user experience, and originality.

## Product Purpose

Poker Face is a local party game built on the Presage SmartSpectra SDK for the DEV Presage challenge (deadline 2026-11-22). One Player keeps a straight face for a timed round while the room tries to make them laugh. The camera counts **cracks**: moments where the face departs clearly from the Player's own calibrated resting face (the baseline). Fewest cracks wins; a longer time to the first crack breaks ties. Success: a room laughs together, understands the screen from across the room without explanation, and wants a Rematch.

## Positioning

A game about "did you crack?", never "are you lying?". Scores come from the Player's own baseline, so no one is compared to a population norm. It is the entry in the contest that is a multiplayer party game rather than a wellness or coaching tool.

## Operating Context

- Flow: API key, camera pick and test (small live preview in the bottom-right corner), Lobby (1 to 6 names), one Consent screen, Ready-player, Calibration ("Get in frame" stage with the SDK's own hint, then an 8 s countdown), Live round, Replay, Session leaderboard with Rematch.
- Live round: 60 s clock; crack counter with a distinct "hit" moment; an ambient **pressure meter** driven by slow pulse and breathing averages that settles during the first ~20 s; a "Back in frame" pause banner when the face is lost; the camera preview in a corner.
- Replay: a 15 to 20 s timeline with crack timestamps and speaking events.
- Session vocabulary (CONTEXT.md): Player, Challenger, Hot seat, Session, Lap, Round, Calibration, Baseline, Crack, Pressure meter. Avoid: subject, contestant, turn, tell, lie, slip, fail, lie detector, stress meter.
- Network is required (the SDK authenticates the key against the Presage backend); metrics are computed on-device.
- Sound effects will be added later and must match the chosen visual direction.

## Capabilities and Constraints

- Reads only: expression change, blinks, talking, plus pulse and breathing averages. Nothing is recorded or stored.
- The **pressure meter is ambient mood for the room, not a measurement**. It must never be presented, named or worded as lie detection, stress, health, or any diagnosis, and has no effect on score.
- Copy says what the face "showed", never "you lied".
- Must read from across a room: big type, high contrast, glanceable.
- Holding still is part of the rules, which also suits the SDK's stationary-subject requirement.
- Contest prohibitions: no diagnosis or treatment claims, no covert or non-consensual monitoring (hence the single Consent screen).
- The submission is in English.
- Undecided: final sound design; whether sharing/export of the Replay exists.

## Brand Commitments

- The game is named **Poker Face** (decision of the user; the "working name" label in older docs is retired).
- Honest, playful voice. Never accusatory.

## Evidence on Hand

- `CONTEXT.md` (glossary and framing), `README.md`, `docs/dev-post.md`, `odd/tasks/*`.
- Incumbent look: `src/renderer/src/assets/main.css` (dark `#0b0b0f`, yellow accent `#ffd23f`, system sans). Treated as evidence for a redesign, not as a constraint.
- App icon assets in `build/` and `resources/icon.png`.
- No real player photos, testimonials or usage data exist; none may be invented.

## Product Principles

1. **The room is the audience.** Every screen is built for people several metres away, in a lively room, not for one person at arm's length.
2. **Name the moment, never the verdict.** The screen reports what the face showed (a crack) and never judges truth, health or stress.
3. **Your own baseline is the yardstick.** Fairness comes from comparing each Player only with themselves.
4. **Setup is quiet, the round is loud.** Setup screens are plain and unmistakable; the theatre is spent on calibration, the round and the reveal.
5. **Nothing is kept.** The interface says what is read and that nothing is recorded or stored.

## Accessibility & Inclusion

- Contrast and size chosen for distance viewing; a crack or state change is never conveyed by colour alone. [inferred]
- Motion respects reduced-motion preference. Flashing is kept slow and low-area (party setting, mixed audience). [inferred]
