---
name: Poker Face · Fight Night
description: A title-fight broadcast for a living-room party game. Black arena, one lamp, slanted condensed caps, one colour that means "crack".
colors:
  void: "#06070b"
  steel: "#11141c"
  steel-2: "#1a1f2b"
  line: "#2f3748"
  light: "#f6f2e9"
  dim: "#b3bac8"
  faint: "#8a92a4"
  crack: "#ff4a3b"
  blue: "#58aeff"
  gold: "#f4c34f"
  ink: "#1a1405"
typography:
  display:
    fontFamily: "'Bahnschrift Condensed', 'Bahnschrift SemiBold Condensed', 'Bahnschrift', 'Franklin Gothic Medium', 'Arial Narrow', sans-serif"
    fontWeight: 700
    textTransform: uppercase
    lineHeight: 0.92
  body:
    fontFamily: "'Bahnschrift', 'Segoe UI', system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0
spacing:
  base: 4px at a 16px root
  scale: [0.25rem, 0.5rem, 0.75rem, 1rem, 1.5rem, 2rem, 3rem, 4rem]
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
  button-secondary:
    backgroundColor: "{colors.steel-2}"
    textColor: "{colors.light}"
    rounded: "{rounded.none}"
---

# Design System: Poker Face · Fight Night

Source of truth for tokens: `src/renderer/src/assets/main.css` (custom properties in `:root`). Chosen direction: `design/visual-direction/01-fight-night.html`. Token tables and the static check page: `design/system.md`, `design/system.html`.

## 1. Overview

**Creative North Star: "The hot seat is the ring and the room is the crowd."**

Poker Face borrows the chrome of a title-fight broadcast: a black arena under a single lamp, condensed slanted type, a scorebug that never leaves the bottom edge, a fight card in the lobby, a final card at the end. It is built to read from the sofa: one huge number per state, one colour that means "crack", and a clock you can see from the kitchen.

**Key characteristics:**
- Mode: Experience for the round (loud, one number), Operate for setup (plain, unmistakable). Setup is quiet, the round is loud.
- Hard edges. No rounded corners, no cards-in-cards. Slant (8°) is the only flourish on chrome.
- Red is reserved for cracks (counter, slab, frame, timeline pins, variation over the line). Errors are named in words with a tag, not red.
- The pressure meter is a segmented crowd-noise gauge with no danger zone and no colour ramp, and it is labelled ambient, not a measurement.

**This replaces the old look** (yellow `#ffd23f` on near-black `#0b0b0f`, system sans, centred stack of rounded cards, green-to-red pressure bar, 2 Hz red glow). That look is retired and is an anti-reference, not a fallback.

## 2. Colors

Dark arena palette. Gold is the title and action colour; blue is the corner colour (hot seat tag, who-line, filled seats); red is crack only.

- **Arena Black** (`void` #06070b): the floor. Page background.
- **Steel** (`steel` #11141c) and **Steel 2** (`steel-2` #1a1f2b): panels, slots, scorebug, inactive segments.
- **Line** (`line` #2f3748): 1px borders on steel.
- **Spotlight** (`light` #f6f2e9): primary text and numbers, lit meter segments.
- **Dim** (`dim` #b3bac8): secondary text. **Faint** (`faint` #8a92a4): placeholders and "Open seat" only.
- **Crack Red** (`crack` #ff4a3b): cracks only.
- **Corner Blue** (`blue` #58aeff): hot seat identity.
- **Title Gold** (`gold` #f4c34f): primary buttons, wordmark accent, leading meter segments, winner row. Text on gold is **Ink** (`ink` #1a1405).

Rules: never gold and red together as meaning; state is never colour alone (see Do's and Don'ts). Contrast on void/steel: light ≥ 15:1, dim ≥ 8:1, faint ≥ 5:1, ink on gold ≥ 10:1.

## 3. Typography

- **Display:** Bahnschrift Condensed (Windows system font, variable), 700, uppercase, line-height 0.92. Fallbacks: Bahnschrift SemiBold Condensed, Bahnschrift, Franklin Gothic Medium, Arial Narrow. No downloaded fonts.
- **Body:** Bahnschrift, then Segoe UI.
- Root size scales with the screen: `clamp(12px, min(1.25vw, 2vh), 28px)` (16px at 1280×800). All sizes are `rem`, so the whole broadcast scales together for a TV.

Scale (at 16px root): countdown 380 · crack counter 330 · wordmark 156 · hero 136 · clock 118 · name 74 · title 72 · slot 36 · label 26 · body 20 · small 16 (floor, nothing is smaller). Tracking: caps labels +0.06 to +0.14em, display 0 to -0.02em, never below -0.04em. Numerals that change (clock, counters, rows) use tabular figures.

## 4. Elevation

Mostly flat: depth comes from the single lamp (radial and conic light from the top edge, drifting slowly), steel surfaces and 1px lines. Two soft shadows only: the camera monitor (`0 1.125rem 2.5rem rgba(0,0,0,.45)`) and large numerals (`0 0.5rem 1.5rem rgba(0,0,0,.5)`). No hard offset shadows, no glows.

## 5. Components

- **Button:** parallelogram (clip-path, label stays upright), display caps 30px. Primary = gold/ink, secondary = steel-2 with dim top and bottom rules. Hover lifts 2px. Focus drops the slant and draws a 4px light outline. Disabled 40% and not-allowed.
- **Input/select:** steel fill, 2px line border, 26px text; focus turns the border gold and adds the gold outline.
- **Bug:** fixed 44px footer on every screen: gold slanted brand slab, context text, and the promise ("Nothing is recorded or stored"; in the round, the entertainment disclaimer).
- **Fight card (lobby):** six slots: number cell, name, remove, corner stripe (blue when filled, line grey for "Open seat").
- **Scorebug (round):** hot seat name with blue tag, clock centre in void, abort quiet at the right.
- **Crack moment:** slab slams in with a clip wipe ("Crack!" and "That's N"), counter thuds from red to light, a red frame bleeds out in 1.2 s. "Cracking now" tag stays while the crack lasts.
- **Pressure meter:** 30 slanted segments, lit = light, leading two = gold, with "Quiet room / Loud room" and a Rising/Dropping/Steady word plus a drawn triangle.
- **Pause:** "Back in frame" gold slab over a scrim.
- **Timeline:** crack = full-height red slab with a light flag at the top; spoke = short light tick at the bottom; legend below.
- **Final card:** winner row is gold and larger; others steel.
- **Camera monitor:** the `video.camera-preview`, 240×135 bottom-right above the bug, 2px dim frame, mirrored.
- **Error:** steel box, 2px light border, "Problem" tag.

## 6. Do's and Don'ts

Do:
- Convey every crack and state change with text or shape as well as colour (slab words, flag shape, "Over the line", "Back in frame", dashed vs solid face badge).
- Keep motion to one authored moment (the crack) plus the slow lamp drift; honour `prefers-reduced-motion` (no animation or transition at all; the crack slab shows only while a crack is active).
- Keep flashes slow and small: one 1.2 s fade of a 16px frame per crack, never repeating.
- Keep body ≥ 16px at 1280×800 and key numbers huge.

Don't:
- Use red for anything but a crack. Don't add a danger zone or colour ramp to the pressure meter.
- Describe the pressure meter, or anything on screen, as lie detection, health, stress or a measurement.
- Add rounded cards, gradient text, side-stripe callouts, emoji or glyph icons, or downloaded fonts.
