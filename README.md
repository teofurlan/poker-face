# Poker Face (working name)

A party game for the [DEV Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04). One player sits in front of the camera and keeps a straight face while everyone else tries to crack them. The game scores what the body lets slip and never claims to know whether someone is lying.

**Status (2026-11-06):** the idea and plan are agreed; no code exists yet. The next step is the technical spike (Plan, step 1).

## Core idea

- **The question is "did you crack?", not "are you lying?".** The user chose this framing from the start, and the research confirmed it (see "Why this framing").
- **Rounds:** one player is in the hot seat. The others try to break their composure with awkward questions, jokes, bluffs or staring. Round rules were decided on 2026-11-12 in [the round ticket](https://github.com/teofurlan/poker-face/issues/6).
- **Cracks are detected live** from the fast SDK signals: a micro-smile or any expression change (`face.expression`), a nervous blink (blink detection), and talking (`face.talking`, to separate answering from holding still).
- **Background tension builds through the round** from the slower signals: pulse (a 12 s average) and breathing (a 30 s average, from the upper chest waveform). They feed a "pressure" meter rather than instant verdicts.
- **End-of-round replay:** a timeline with each crack marked. It is the shareable moment and the centerpiece of the demo video.
- **Honest copy everywhere:** "it showed," never "you lied." The game makes no claims about truth, health, or stress diagnosis.

## Why this framing

- **Lie detection is already done with this SDK:**
  - *Vital Verdict* ([Devpost](https://devpost.com/software/vital-verdict)) is an Among Us-like game where players see each other's pulse. It uses Presage SmartSpectra.
  - *Trust Me Bro* ([Devpost](https://devpost.com/software/trust-me-bro-i74zut), HackBrown 2026) is a bluffing game with a "lie-detecting hat."
  - The Devpost pages returned 403, so their prizes are unverified.
- **Lie detection is sensitive for this sponsor.** Presage was selected for the DoD/DIU *Polygraph+* credibility-assessment prototype ([DIU, 2024](https://www.diu.mil/latest/department-of-defense-defense-innovation-unit-announce-polygraph-effort-to)), and physiological lie detection is not reliable.
- **It matches what the SDK actually does.** Pulse is a 12 s average, too slow to react to a single answer, while expressions, blinks and talking are fast.
- **The contest has no game like this yet.** On 2026-11-06 the DEV API returned about 17 submissions (6 empty). They cluster around:
  - calm/stress wellness and breathing visuals: Aura, Glassbreath, Presage Sense, CodeCalm, The Living Darkroom;
  - pressure coaching: HalfBeat, the VTU viva examiner, Bud AI;
  - one dev tool: Rubber Duck Gate.

  No party or multiplayer game was among them. This is a snapshot, and more entries will arrive before the deadline.

## Challenge constraints

- **Deadline:** November 22, 2026, 11:59 PM PST. Solo entry, one submission per person, entrant 18+.
- **Prizes require an English submission.**
- **The submission needs:**
  - a DEV post using the template and the `#presagechallenge` tag;
  - a public repository with setup instructions;
  - a demo video showing the live Presage signals;
  - a Consent and Data Handling section.
- **Prohibited:** diagnosis or treatment claims, medical decision-making, and covert or non-consensual monitoring ([contest rules](https://dev.to/page/presage-2026-11-04-contest-rules)).
- **Judging criteria:** use of the technology, usability and user experience, and originality. Ties go to the most positive reactions on the DEV post.
- **Target categories:** *Most Creative or Delightful Use* first; the overall winner spots also apply.

## SDK facts that shape the design

From the [SmartSpectra docs](https://smartspectra.presagetech.com/docs), read 2026-11-06:

- **Vitals require a stationary subject.** Large motion can produce wrong values reported with high confidence. In the game, holding still is the rule anyway.
- **Signals and windows:**
  - pulse: a 12 s average, valid from 40 to 110 BPM;
  - breathing: a 30 s average;
  - HRV: 60 s;
  - face analysis: 478 landmarks, blink, talking, and expression probabilities.
- **Platforms:** Node.js/Electron (win32-x64 supported), C++ (Windows is experimental), Android and Swift.
- **Processing and network:** metrics are computed on-device. The SDK calls the Presage backend only to authenticate the API key, so a network connection is required.
- **Probably one subject at a time.** This is unverified; checking it is part of the spike.

## Plan

1. **Spike (1-2 days).** Get a free API key and run the Node SDK on Windows with a webcam. Measure:
   - the latency of expression, blink and talking events;
   - how stable expression probabilities are;
   - how many faces the SDK tracks;
   - how pulse and breathing behave over a 60-90 s round.

   Go/no-go: crack events must arrive in under about 1 s.
2. **Game design (half a day).** Define the round length, the crack thresholds relative to a per-player baseline (calibrated in the first seconds), scoring, the number of players, and the screen layout so the room can see it.
3. **Core loop (days 3-7).** Build the consent screen, calibration, a live round with the crack meter and pressure meter, the replay timeline, and a leaderboard for the session.
4. **Polish (days 8-11).** Add sound, animations, a sample-recording mode that runs without a camera or key (the strongest entries have one), and installers or simple setup.
5. **Submission (days 12-14).** Write the README, the consent and data section, and the demo video (a real round with friends). Publish the DEV post with the optional agent session. Leave a buffer day before November 22.

## Consent and data (design intent)

- One consent screen in the lobby lists every player; pressing it means everyone listed agrees (decided 2026-11-12, [round ticket](https://github.com/teofurlan/poker-face/issues/6)). Anyone unwilling removes their name first. The camera runs only during each player's own round.
- Nothing is recorded or uploaded. Only the timeline of crack events stays in memory, and it is cleared when the session ends.
- The SDK network call is limited to API key authentication; disclose it and any SDK telemetry.

## Open questions

- The final name.
- ~~The tech stack~~: decided 2026-11-11, an Electron desktop app (TypeScript, electron-vite, React); see [the stack ticket](https://github.com/teofurlan/poker-face/issues/5).
- Whether the observers also see the pulse or breathing live, or only the cracks. The trade-off is drama versus privacy.
- Whether to add an optional "dare deck" of prompts for the challengers.
