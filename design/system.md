# Design system: Fight Night

Chosen direction: `design/visual-direction/01-fight-night.html` (owner pick, 2026-11-15). Prose and rules live in `DESIGN.md`; the implementation is the `:root` custom properties in `src/renderer/src/assets/main.css`; `design/system.html` is a static check page that loads that stylesheet (open with `?f=<frame>` for one frame, `?still` to freeze animation).

**The old look is retired.** The previous system (yellow `#ffd23f` on `#0b0b0f`, system sans, centred rounded cards, green-yellow-red pressure gradient, 2 Hz red glow) is no longer a reference and no longer in the code. Do not reintroduce its tokens.

No Tailwind, `@theme` or component library: tokens are plain CSS custom properties.

## Colors

| Token | Value | Usage |
| --- | --- | --- |
| `--void` | `#06070b` | Arena floor, page background, clock cell |
| `--steel` | `#11141c` | Panels, slots, scorebug, bug footer |
| `--steel-2` | `#1a1f2b` | Inactive segments, secondary button, number cells |
| `--line` | `#2f3748` | 1px borders |
| `--light` | `#f6f2e9` | Primary text, numbers, lit meter segments |
| `--dim` | `#b3bac8` | Secondary text, labels |
| `--faint` | `#8a92a4` | Placeholders, "Open seat" |
| `--crack` | `#ff4a3b` | Cracks only (counter, slab, frame, timeline pins, variation over the line) |
| `--blue` | `#58aeff` | Corner colour: hot seat tag, who-line, filled seats |
| `--gold` | `#f4c34f` | Title and action: primary buttons, wordmark accent, leading meter segments, winner row |
| `--gold-hi` | `#ffd978` | Primary button hover |
| `--ink` | `#1a1405` | Text on gold |
| `--scrim` | `rgba(6,7,11,.82)` | Pause and void overlay |

## Typography

- `--display`: Bahnschrift Condensed, Bahnschrift SemiBold Condensed, Bahnschrift, Franklin Gothic Medium, Arial Narrow, sans-serif. 700, uppercase, line-height 0.92.
- `--body`: Bahnschrift, Segoe UI, system-ui, sans-serif.
- Root: `clamp(12px, min(1.25vw, 2vh), 28px)`; all sizes in `rem` (px below at 16px root).

| Token | rem | px | Use |
| --- | --- | --- | --- |
| `--fs-count` | 23.75 | 380 | Calibration countdown |
| `--fs-crack` | 20.625 | 330 | Crack counter |
| `--fs-wordmark` | 9.75 | 156 | Lobby wordmark |
| `--fs-hero` | 8.5 | 136 | "Get in frame", "Final card" (6rem with 5+ players) |
| `--fs-clock` | 7.375 | 118 | Round clock |
| `--fs-name` | 4.625 | 74 | Hot seat name in scorebug |
| `--fs-title` | 4.5 | 72 | Setup screen titles, replay headline |
| `--fs-slot` | 2.25 | 36 | Names on the card, meter title |
| `--fs-label` | 1.625 | 26 | Card headings, lede |
| `--fs-body` | 1.25 | 20 | Body copy |
| `--fs-small` | 1 | 16 | Floor |

Tracking: caps labels +0.06 to +0.14em; display 0 to -0.02em. Tabular numerals for clock, counters and rows.

## Spacing

4px base: `--s-1` 0.25rem, `--s-2` 0.5, `--s-3` 0.75, `--s-4` 1, `--s-5` 1.5, `--s-6` 2, `--s-7` 3, `--s-8` 4. Page gutter `--gutter` 4.5rem. Bug height `--bug-h` 2.75rem.

## Radius

`--r-none: 0`. Everything is hard-edged. The only curves are the calibration oval (a framing guide) and nothing else. Shape language is a slant: `--skew: -8deg` (buttons via clip-path, slabs, segments, brand).

## Shadows

| Token | Value | Use |
| --- | --- | --- |
| `--shadow-lift` | `0 1.125rem 2.5rem rgba(0,0,0,.45)` | Camera monitor |
| `--shadow-num` | `0 0.5rem 1.5rem rgba(0,0,0,.5)` | Large numerals and the hot seat name |

No glows, no hard offsets. The lamp is a radial plus conic light from the top edge.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease` | `cubic-bezier(.16,1,.3,1)` | All easing (exponential ease-out) |
| `--d-fast` | 200ms | Button hover |
| `--d-slam` | 350ms | Crack slab clip wipe |
| `--d-thud` | 500ms | Counter thud (scale 1.35 to 1, red to light) |
| `--d-edge` | 1200ms | Red frame bleed-out, once per crack |
| `--d-hold` | 2600ms | Slab holds before a 600ms fade |
| `--d-drift` | 14s | Lamp sweep |

Calibration oval breathes (3.2s alternate). `prefers-reduced-motion: reduce` turns every animation and transition off; the crack slab then shows only while a crack is active, and the "Cracking now" tag, counter and variation label carry the state in words.

## Components

Defined in `DESIGN.md` section 5 and implemented in `main.css`: button (parallelogram), input, bug footer, fight-card slots, scorebug, crack moment, segmented pressure meter, pause slab, timeline, final card, camera monitor, error box.

## Accessibility notes

- State is never colour alone: crack = words ("Crack!", "Cracking now", "over the line") + flag shape on the timeline + motion; face seen = solid gold slab vs hollow dashed frame with different words; meter trend = word + drawn triangle; errors = "Problem" tag.
- Flashing: one 1.2s fade of a 1rem frame per crack. No loop above 0.5 Hz.
- Pressure meter copy: "Ambient mood from slow pulse and breathing. Just for the room, not a measurement." It has no danger colour and no effect on score.
