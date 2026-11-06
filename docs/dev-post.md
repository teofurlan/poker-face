---
title: "Poker Face: a party game where your face is the only tell (built in public)"
published: true
tags: devchallenge, presagechallenge, gamedev, webdev
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04)*

> 🚧 **Built in public.** This post is updated as the project moves forward. The build log at the end shows what is done and what is still planned. Anything not marked as done is a plan, not a working feature yet.

## What I Built

**Poker Face** is a party game for a room of friends and one webcam.

One player sits in the hot seat and has a single job: **keep a straight face.** Everyone else has 60-90 seconds to crack them with awkward questions, terrible jokes, fake bluffs or plain staring.

The game watches for the moments your face gives you away:

- a micro-smile you tried to swallow;
- a nervous blink;
- an expression that slips for half a second.

Each one is a **crack**, marked live on screen for the whole room to see. At the end of the round you get a **replay timeline** with every crack pinned to the moment it happened, so everyone can see exactly which joke broke you.

What it is **not**: a lie detector. The question the game asks is *"did you crack?"*, never *"are you lying?"*. Physiological lie detection is not reliable, and the game never makes claims about truth, health or stress. It only reacts to what your face visibly lets slip.

## Demo

*Coming soon...*

## Code

*Repository: [github.com/teofurlan/poker-face](https://github.com/teofurlan/poker-face)*

## How It Responds to Human Signals

The design splits the SmartSpectra signals by speed:

- **Fast signals become cracks.** Expression probabilities, blink detection and talking detection react in real time. A crack is a deviation from *your own* baseline, calibrated during the first seconds of your turn, so a naturally smiley person isn't punished for their resting face. Talking detection separates "answering a question" from "holding still", so answering doesn't count as a crack.
- **Slow signals become pressure.** Pulse (a 12-second average) and breathing (a 30-second average) are too slow to react to a single joke, so they don't produce verdicts. They feed a **pressure meter** that builds tension across the round instead.
- **Holding still is the rule.** SmartSpectra vitals need a stationary subject, and in Poker Face sitting still is part of the game anyway.

*Integration details (SDK, platform, event latency and thresholds) will be added after the technical spike.*

## Prize Categories

**Most Creative or Delightful Use.**

Most human-sensing apps point the camera at you to help you calm down. Poker Face points it at you so your friends can try to make you lose it. It turns a sensing SDK into a shared, social moment: the screen is for the whole room, the sensor reads one brave volunteer, and the best part of the round is the replay where everyone sees exactly when you broke.

## Consent and Data Handling

*Design intent; this section will be updated to match the final build.*

- **Explicit opt-in per player.** Every player agrees on screen before their own turn. Nobody is analyzed just for being in the room.
- **The camera runs only during your round,** with a visible indicator, and stops when the round ends.
- **No video is recorded, stored or uploaded.** Only the list of crack events (a timestamp and type) is kept, in memory, to draw the replay. It is cleared when the session ends.
- **Network:** SmartSpectra processes frames on-device. The SDK contacts the Presage backend to validate the API key; any SDK telemetry will be documented here once confirmed.
- **No health or truth claims.** The game does not diagnose, measure stress clinically, or decide whether anyone is lying.

## Agent Session

*Coming soon: curated slices of the coding-agent session used to plan and build the game.*

## Build log

- **2026-11-06:** Idea and framing decided; repository created; planning in progress. Next: a technical spike to measure how fast expression and blink events arrive (the go/no-go for live cracks).
