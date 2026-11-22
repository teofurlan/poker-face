# Poker Face

A local party game for Windows built on the [Presage SmartSpectra SDK](https://smartspectra.presagetech.com/) for the [DEV Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).

One **Player** sits in the **Hot seat** in front of the webcam and tries to keep a straight face in silence for 60 seconds, while everyone else (**Challengers**, up to 6 players in a session) tries to make them laugh. The game asks **"did you crack?"**, never **"are you lying?"**, and makes no claims about truth, health, or clinical stress.

## How It Works

1. **Setup (or Demo round):** On first launch, enter your free Presage API key from [physiology.presagetech.com](https://physiology.presagetech.com) (saved encrypted on your machine via Electron `safeStorage`, or set via `PRESAGE_API_KEY`) and select a webcam. You can also click **Try a demo round** without a webcam, internet connection, or API key.
2. **Tonight's card (Lobby) & Consent:** Add 1 to 6 player names in entry order, then confirm the single **Consent & Privacy** screen before play begins. Anyone unwilling removes their name before starting.
3. **Hot Seat & Calibration:** Each player gets a **Next in the Hot Seat** staging screen (`Start 8s Calibration` or `Back to Lobby`). Calibration warms up the webcam for 1.5 s so auto-exposure settles, waits until the SDK reports valid framing (`Face OK` for 1 s), and averages an 8-second resting **Baseline** (up to 2 retries if valid framing drops below 80%). Press **Cancel** (or `Esc`) at any stage to stop the camera and return to the player's ready screen without losing the multiplayer session.
4. **Live Round (60 s):** Sit facing the camera in silence. Any sharp facial departure from your personal baseline counts as a **Crack**—triggering a counter thud, red edge bleed, and **CRACK!** callout—while slow pulse and breathing averages feed an ambient **Room pressure** meter after a 20 s settling window. Losing face visibility pauses the clock with a **Back in frame** banner (over 10 s cumulative loss voids the round).
5. **Replay & Final Card:** Each round ends with a 60-second **Replay timeline** showing every crack and any detected `Spoke` marks. After one **Lap** through all players, the **Final card** leaderboard ranks everyone by fewest cracks, breaking ties by longest time to the first crack, with a **Rematch** button for another lap.

Look and sound follow the **Fight Night** broadcast direction (`Bahnschrift` typography, red reserved exclusively for cracks, shape/text paired with color on every indicator, `prefers-reduced-motion` support) with optional Web Audio synthesized sound effects and a remembered **Sound: On/Off** toggle in the footer bar.

## Demo Round (No Camera, Key, or Credits)

Click **Try a demo round** on the API key or camera selection screen to play a full round—calibration, crack detection, room pressure meter, replay timeline, and leaderboard—using a real session recorded during development (`src/renderer/src/demo/recording.json`, developer's own face used with consent). Your camera stays closed, no network request is made, no credits are spent, and every screen displays a **Demo: recorded session** badge.

## How It Uses Presage SmartSpectra

Poker Face runs `@smartspectra/node-sdk` in **Electron renderer mode**: the renderer window owns the webcam `MediaStream` (`1280x720` @ `30 fps` ideal), displays the mirrored live monitor, and streams frames through `bindSmartSpectraIpc` to the main process for on-device processing.

- **Fast signals → Cracks:** Raw SmartSpectra expression labels frequently score a resting poker face as `SAD`. Instead of trusting labels, Poker Face measures **Total Variation Distance** (`0.5 * sum(|sample_i - baseline_i|)`) across the 8 expression classes relative to each player's own 8 s baseline. A crack begins at `>= 40`, ends once variation stays `< 25` for `500 ms` (hysteresis), and enforces a `1000 ms` cooldown so one laugh counts as a single crack.
- **Slow signals → Room pressure:** Pulse (12 s average) and breathing (30 s average) drive the **Room pressure** meter purely as theatrical mood for challengers; it has no effect on score. If chest framing is lost (`kChestNotVisible`), the round continues without pausing and the meter holds gracefully.
- **Camera warm-up & teardown:** Because SmartSpectra's renderer pipeline locks camera exposure to manual at start (`_tryLockCameraParameters`), Poker Face previews and warms up the stream for 1.5 s first. Sessions enforce `enableTelemetry: false`, wait for clean camera teardown on window close (`Alt+F4`), and exit the process if a billed session ever hangs on stop.
- **Unpacked native packaging:** Windows builds set `asar: false` in [electron-builder.yml](electron-builder.yml) so native SDK DLLs resolve from real paths on disk.

## Consent and Data Handling

- **Explicit opt-in:** One shared consent screen lists every player in the lobby before play begins. Unwilling players must be removed before continuing.
- **Scoped camera activation:** The webcam opens only during camera testing, calibration, and each player's own round, with a mirrored live preview always visible on screen.
- **Nothing recorded or uploaded:** Processing runs on-device; only in-memory crack timestamps and spoke markers exist during the session to render the replay and leaderboard, and everything clears on reset or exit.
- **Network & key storage:** Network access is required only to validate your Presage API key against Presage's backend. SDK telemetry is disabled (`enableTelemetry: false`). Saved keys are encrypted on disk with Electron `safeStorage` (or provided via `PRESAGE_API_KEY`) and never bundled.
- **No lie detection or medical claims:** Poker Face is strictly an entertainment party game.

## Run It

### Windows Installer (Windows 10/11 x64)

Download `poker-face-1.0.0-setup.exe` from the repository's GitHub Releases page. The installer is unsigned, so Windows SmartScreen will display a warning on first run.

### Run From Source

**Prerequisites:** Windows 10 or 11 (x64), Node.js 20+ (tested on Node 22), a webcam, an internet connection, and a free Presage API key from [physiology.presagetech.com](https://physiology.presagetech.com) (not needed for Demo mode).

```sh
git clone https://github.com/teofurlan/poker-face.git
cd poker-face
npm install
npm run dev
```

- If `PRESAGE_API_KEY` is set in your environment, the app skips the API key screen automatically.
- If `npm run dev` fails with `Error: Electron uninstall`, run `node node_modules/electron/install.js` and start again.

**Other commands:**

- `npm test` — run Vitest unit tests
- `npm run lint -- --max-warnings 0` — run ESLint + Prettier checks
- `npm run build` — run Node & Web TypeScript checks and build with `electron-vite`
- `npm start` — preview the production build with `electron-vite preview`
- `npm run build:win` — package the unsigned Windows NSIS installer into `dist/`

## Project Structure

- `src/main/` — Electron window lifecycle, `isAppUrl` navigation guard (`appUrl.ts`), encrypted `safeStorage` API key store (`apiKey.ts`), camera persistence (`camera.ts`), and IPC handlers (`ipc.ts`)
- `src/preload/` — sandboxed `contextBridge` API and `@smartspectra/node-sdk/preload` bridge
- `src/renderer/src/game/` — baseline calibrator, Total Variation crack detector, pressure meter, round clock, and multiplayer session state machine
- `src/renderer/src/face/` — renderer camera session lifecycle with warm-up, cancellation, and StrictMode guards
- `src/renderer/src/demo/` — recorded spike session asset and `FaceSource` replay adapter
- `src/renderer/src/audio/` — zero-dependency Web Audio cue rules, synthesizer, and mute persistence
- `src/renderer/src/components/` — Fight Night React screens and shared chrome
