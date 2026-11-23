---
title: 'Poker Face: a party game where your face is the only tell'
published: true
tags: devchallenge, presagechallenge, gamedev, webdev
---

_This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04)_

## What I Built

**Poker Face** is a party game for a room of friends and one webcam.

One player sits in the hot seat and has a single job: **keep a straight face, and keep quiet.** Everyone else has 60 seconds to crack them with awkward questions, terrible jokes, fake bluffs or plain staring.

Each person takes the hot seat once, in turn (one to six people). The player with the fewest cracks wins; on a tie, whoever held out longest before their first crack wins. A rematch starts a fresh leaderboard.

The game watches for the moments your face gives you away:

- a micro-smile you tried to swallow;
- a flash of surprise you couldn't hold back;
- an expression that slips for half a second.

Each one is a **crack**, marked live on screen for the whole room to see. At the end of the round you get a **replay timeline** with every crack pinned to the moment it happened, so everyone can see exactly which joke broke you.

What it is **not**: a lie detector. The question the game asks is _"did you crack?"_, never _"are you lying?"_. Physiological lie detection is not reliable, and the game never makes claims about truth, health or stress. It only reacts to what your face visibly lets slip.

## Demo

{% youtube 7BGfqpd4FUw %}

_[Watch the 22-second launch demo on YouTube](https://youtu.be/7BGfqpd4FUw). The launch film pairs an illustrative AI demo webcam preview (labelled on screen) with real SmartSpectra SDK trace values from the recorded Demo round._

**Try it without a camera or an API key.** The live game needs a webcam, an internet connection and your own Presage API key, and every live session spends SDK credits. Most people reading this won't have all of that set up, so the app includes a **demo round**: press _Try a demo round_ on the first screen. It replays a real session I recorded with the same SDK during development (my own face, cued smiles and surprises) through the exact same calibration, crack detection, pressure meter, replay and leaderboard as a live round. Your camera is never opened and nothing is recorded; every demo screen is labelled _Demo: recorded session_ so it's never mistaken for a live reading.

## Code

_Repository: [github.com/teofurlan/poker-face](https://github.com/teofurlan/poker-face)_

**Stack:** a Windows desktop app built with Electron, TypeScript, electron-vite and React, running the SmartSpectra Node SDK in its Electron renderer mode: the window opens the camera, shows a live camera preview and feeds the same frames to the SDK, which processes them in the main process. One fullscreen window is the shared screen for the whole room (mirror it to a TV if you have one). You can run it from source (`npm install`, `npm run dev`). On first launch it asks for your Presage API key and lets you pick your camera from a list. A packaged Windows installer (`poker-face-1.0.0-setup.exe`) is available on [GitHub Releases](https://github.com/teofurlan/poker-face/releases/tag/v1.0.0); it is unsigned, so Windows SmartScreen warns before installing it.

**Look and sound:** the screen is styled like a title-fight broadcast ("Fight Night"): a "Tonight's card" lobby, a scorebug with the round clock and the crack count, and a "Final card" leaderboard. Red is reserved for cracks, and every state change also has a shape or a word, so nothing depends on colour alone. Optional sound effects are synthesized in the browser with Web Audio, with no audio files: a bell for each calibration second, a thud and a camera-flash pop on each crack, a faster tick in the last ten seconds and a quiet crowd murmur that follows the pressure meter. A sound toggle on every screen remembers your choice.

## How It Responds to Human Signals

The design splits the SmartSpectra signals by speed:

- **Fast signals become cracks.** Expression probabilities react in real time. A crack is how far your face moves away from _your own_ baseline, calibrated during an 8-second settle before your clock starts, so a naturally smiley person isn't punished for their resting face. One laugh counts as one crack, however long it lasts. The hot seat is silent: talking detection arrives a second or more late, too late to excuse an answer, so the player doesn't answer at all. Talking only shows up as a "spoke" mark on the replay and never changes the score.
- **Slow signals become pressure.** Pulse (a 12-second average) and breathing (a 30-second average) are too slow to react to a single joke, so they don't produce verdicts. They feed a **pressure meter** that builds tension across the round instead.
- **Holding still is the rule.** SmartSpectra vitals need a stationary subject, and in Poker Face sitting still is part of the game anyway.

**What the spike measured** (2026-11-10, one player, a laptop webcam, cued expressions):

- Face samples reach the app about **50 ms** after the frame is captured (under 75 ms for 95% of them), at about 28 samples per second.
- A deliberate smile or look of surprise registers as a crack **about 1-2 seconds after the on-screen cue**, including the player's own reaction time.
- The expression _labels_ are not usable on their own: my resting poker face scored as "sad" most of the time. So Poker Face never asks "is this a smile?". It only asks "how much did your face change from your own baseline?" That change stayed under the threshold almost always while I held still.
- Blink detection proved unreliable, so blinks are not cracks.
- Pulse and breathing need your chest in frame, take about 20 seconds to produce a first reading, and swing a lot. They will never count as cracks.

These numbers come from one person in one room and directly drove the shipped detection rules (Total Variation threshold `>= 40`, hysteresis release `< 25` for `500 ms`, and `1000 ms` cooldown).

## Prize Categories

**Most Creative or Delightful Use.**

Most human-sensing apps point the camera at you to help you calm down. Poker Face points it at you so your friends can try to make you lose it. It turns a sensing SDK into a shared, social moment: the screen is for the whole room, the sensor reads one brave volunteer, and the best part of the round is the replay where everyone sees exactly when you broke.

## Consent and Data Handling

_This section describes the current build._

- **Explicit opt-in before playing.** Before the first round, a consent screen lists everyone's name and explains what the game reads; pressing the button means everyone listed agrees. Anyone who doesn't want to take part removes their name before the game starts. Nobody outside the list is analyzed.
- **The camera runs only during calibration and your round,** with a mirrored live preview on screen so the player always sees what the camera sees, and it stops when calibration is cancelled or the round ends. Closing the app during a round stops the camera session before the window closes.
- **The demo round never opens your camera.** It replays a session recorded from my own face during development.
- **No video is recorded, stored or uploaded.** Only the list of crack events (a timestamp and type) is kept, in memory, to draw the replay. It is cleared when the session ends.
- **Network:** SmartSpectra processes frames on-device. The SDK contacts the Presage backend to validate the API key, so it needs an internet connection. By default it also sends one aggregate diagnostic summary per session (SDK version, platform, frame-rate and quality counts). Per Presage's docs, that summary never contains video frames, measured values or user identifiers, and it can be turned off with `enableTelemetry: false`. Poker Face turns it off.
- **Your API key stays on your computer.** The key you enter is saved only on your machine, encrypted with Electron's `safeStorage` (backed by Windows' own data protection), and is used only by the SDK to authenticate with Presage. Developers can set the `PRESAGE_API_KEY` environment variable instead.
- **No health or truth claims.** The game does not diagnose, measure stress clinically, or decide whether anyone is lying.

## Agent Session

Poker Face was designed and built in structured human-guided agent sessions combining GitHub Wayfinder planning (`#1`–`#9`), a latency spike before app code, and test-first implementation slices backed by independent diff reviews:

- **Evidence before game rules:** Before writing UI, a spike on the real SDK measured ~50 ms sample delivery (`p95 < 75 ms`) and uncovered two surprises: resting poker faces consistently scored `SAD`, and `talking` detection trailed by 1–3 seconds. Those two facts shaped the game itself—scoring shifted to Total Variation distance from each player's own 8 s baseline, and the hot seat became silent.
- **Independent diff verification:** Dedicated read-only review passes caught subtle bugs before merge: hung `stop()` calls that could leave billed SDK sessions running (fixed with a 3 s timeout + forced exit guard), `electron-builder` packaging dev notes alongside native DLLs (replaced with an explicit include-list and `asar: false`), React StrictMode double-mount camera leaks (fixed with an epoch cancellation token in `face.ts`), and Electron security boundaries locking `key:forSession` to our window's main frame and `isAppUrl`.
- **Live-test feedback loop:** Real webcam tests caught real-world issues unit mocks couldn't see—waiting for 1 s of valid framing (`Face OK`) before starting calibration's 8 s timer, moving crack timestamps onto a pause-aware round clock instead of `Date.now()`, waiting for camera teardown on `Alt+F4`, warming up the camera stream for 1.5 s before the SDK locks exposure to manual, and adding cancelable calibration that returns to the player's ready screen without wiping multiplayer progress.
- **Look, sound, and judge access:** From three explored visual directions, the **Fight Night** broadcast identity drove the UI tokens, zero-dependency Web Audio synthesis added optional sound cues, and a recorded **Demo round** replayed the spike's own expression log so judges can play without a camera or API key.
