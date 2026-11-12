---
title: "Poker Face: a party game where your face is the only tell (built in public)"
published: true
tags: devchallenge, presagechallenge, gamedev, webdev
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04)*

> 🚧 **Built in public.** This post is updated as the project moves forward. The build log at the end shows what is done and what is still planned. Anything not marked as done is a plan, not a working feature yet.

## What I Built

**Poker Face** is a party game for a room of friends and one webcam.

One player sits in the hot seat and has a single job: **keep a straight face, and keep quiet.** Everyone else has 60 seconds to crack them with awkward questions, terrible jokes, fake bluffs or plain staring.

Each person takes the hot seat once, in turn (one to six people). The player with the fewest cracks wins; on a tie, whoever held out longest before their first crack wins. A rematch starts a fresh leaderboard.

The game watches for the moments your face gives you away:

- a micro-smile you tried to swallow;
- a flash of surprise you couldn't hold back;
- an expression that slips for half a second.

Each one is a **crack**, marked live on screen for the whole room to see. At the end of the round you get a **replay timeline** with every crack pinned to the moment it happened, so everyone can see exactly which joke broke you.

What it is **not**: a lie detector. The question the game asks is *"did you crack?"*, never *"are you lying?"*. Physiological lie detection is not reliable, and the game never makes claims about truth, health or stress. It only reacts to what your face visibly lets slip.

## Demo

*Coming soon...*

## Code

*Repository: [github.com/teofurlan/poker-face](https://github.com/teofurlan/poker-face)*

**Planned stack:** a Windows desktop app built with Electron, TypeScript, electron-vite and React, running the SmartSpectra Node SDK in the same app. One fullscreen window is the shared screen for the whole room (mirror it to a TV if you have one). You can run it from source (`npm install`, `npm start`), and I'm aiming for a packaged Windows `.exe` as well. On first launch it asks for your Presage API key and lets you pick your camera from a list.

## How It Responds to Human Signals

The design splits the SmartSpectra signals by speed:

- **Fast signals become cracks.** Expression probabilities react in real time. A crack is how far your face moves away from *your own* baseline, calibrated during an 8-second settle before your clock starts, so a naturally smiley person isn't punished for their resting face. One laugh counts as one crack, however long it lasts. The hot seat is silent: talking detection arrives a second or more late, too late to excuse an answer, so the player doesn't answer at all. Talking only shows up as a "spoke" mark on the replay and never changes the score.
- **Slow signals become pressure.** Pulse (a 12-second average) and breathing (a 30-second average) are too slow to react to a single joke, so they don't produce verdicts. They feed a **pressure meter** that builds tension across the round instead.
- **Holding still is the rule.** SmartSpectra vitals need a stationary subject, and in Poker Face sitting still is part of the game anyway.

**What the spike measured** (2026-11-10, one player, a laptop webcam, cued expressions):

- Face samples reach the app about **50 ms** after the frame is captured (under 75 ms for 95% of them), at about 28 samples per second.
- A deliberate smile or look of surprise registers as a crack **about 1-2 seconds after the on-screen cue**, including the player's own reaction time.
- The expression *labels* are not usable on their own: my resting poker face scored as "sad" most of the time. So Poker Face never asks "is this a smile?". It only asks "how much did your face change from your own baseline?" That change stayed under the threshold almost always while I held still.
- Blink detection proved unreliable, so blinks are not cracks.
- Pulse and breathing need your chest in frame, take about 20 seconds to produce a first reading, and swing a lot. They will never count as cracks.

These numbers come from one person in one room; thresholds will be tuned during the build.

## Prize Categories

**Most Creative or Delightful Use.**

Most human-sensing apps point the camera at you to help you calm down. Poker Face points it at you so your friends can try to make you lose it. It turns a sensing SDK into a shared, social moment: the screen is for the whole room, the sensor reads one brave volunteer, and the best part of the round is the replay where everyone sees exactly when you broke.

## Consent and Data Handling

*Design intent; this section will be updated to match the final build.*

- **Explicit opt-in before playing.** Before the first round, a consent screen lists everyone's name and explains what the game reads; pressing the button means everyone listed agrees. Anyone who doesn't want to take part removes their name before the game starts. Nobody outside the list is analyzed.
- **The camera runs only during your round,** with a visible indicator, and stops when the round ends.
- **No video is recorded, stored or uploaded.** Only the list of crack events (a timestamp and type) is kept, in memory, to draw the replay. It is cleared when the session ends.
- **Network:** SmartSpectra processes frames on-device. The SDK contacts the Presage backend to validate the API key, so it needs an internet connection. By default it also sends one aggregate diagnostic summary per session (SDK version, platform, frame-rate and quality counts). Per Presage's docs, that summary never contains video frames, measured values or user identifiers, and it can be turned off with `enableTelemetry: false`. Poker Face turns it off.
- **Your API key stays on your computer.** The key you enter is saved only on your machine, encrypted with Electron's `safeStorage` (backed by Windows' own data protection), and is used only by the SDK to authenticate with Presage. Developers can set the `PRESAGE_API_KEY` environment variable instead.
- **No health or truth claims.** The game does not diagnose, measure stress clinically, or decide whether anyone is lying.

## Agent Session

*Coming soon: curated slices of the coding-agent session used to plan and build the game.*

## Build log

- **2026-11-06:** Idea and framing decided; repository created; planning in progress. Next: a technical spike to measure how fast expression and blink events arrive (the go/no-go for live cracks).
- **2026-11-09:** SDK research done. Blink, talking and 8-class expression scores arrive at frame cadence (about 30 Hz); the SDK tracks exactly one face, so only the hot-seat player can be in frame; telemetry confirmed and documented above. Still to verify in the spike: that face metrics are enabled for this API key, and the real event latency.
- **2026-11-10:** Spike done: go. Face samples arrive in about 50 ms, and a deliberate crack shows on screen about 1-2 s after the cue. Cracks are measured as change from the player's own baseline, because the raw expression labels misread a resting face. Blinks and vitals are out as crack signals. Next: decide what a round looks like.
- **2026-11-11:** Stack decided: an Electron desktop app (TypeScript, electron-vite, React) in one fullscreen window. It runs from source, and I'll try to package a Windows `.exe` in the first build step; if packaging isn't working by 2026-11-15, the app ships as source-only and the post will say so. First launch asks for the API key and the camera.
- **2026-11-12:** Round design decided. A round is 60 seconds after an 8-second calibration, and the hot seat stays silent. One laugh is one crack. Fewest cracks wins, and a session is one lap through every player (one to six). A single consent screen covers everyone in the lobby. The game pauses if the face leaves the frame. Next: decide what the room sees during a round.
