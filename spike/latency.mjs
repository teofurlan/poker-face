// PROTOTYPE (throwaway) for "Do crack events arrive fast enough for live play?".
// Measures, on a live webcam session:
//   1. pipeline latency: frame sent into the SDK -> face sample delivered (same timestampUs)
//   2. cue latency: on-screen cue -> first matching event (includes human reaction time)
//   3. expression stability at rest (false "cracks" with candidate thresholds)
//   4. pulse and breathing behaviour (PHASE=full only)
// Usage: node latency.mjs "<camera name part>"   env: PHASE=face|full, RUN_MS, LOG_INFO=1
// Every run spends SDK credits; it always stops itself after RUN_MS.
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  SmartSpectraSDK, CameraSelection, SmartSpectraLogLevel,
  faceMetrics, cardioMetrics, breathingMetrics, decodeMetrics,
} from '@smartspectra/node-sdk';

const PHASE = process.env.PHASE ?? 'face';
const RUN_MS = Number(process.env.RUN_MS ?? (PHASE === 'full' ? 90_000 : 60_000));
const WARMUP_MS = PHASE === 'full' ? 20_000 : 10_000; // time to fix framing before the first cue
const DELTA = Number(process.env.DELTA ?? 25); // crack = class rises this many points above the player's own baseline
const apiKey = process.env.PRESAGE_API_KEY;
if (!apiKey) { console.error('PRESAGE_API_KEY is not set'); process.exit(2); }

const cameraName = process.argv[2];
const camera = cameraName
  ? SmartSpectraSDK.availableCameras().find((c) => c.name.includes(cameraName))
  : undefined;
if (cameraName && !camera) { console.error('camera not found:', cameraName); process.exit(2); }

// Cue script. `match` decides whether a delivered face sample counts as the reaction.
const EXPR = ['ANGRY', 'CONTEMPT', 'DISGUST', 'FEAR', 'HAPPY', 'NEUTRAL', 'SAD', 'SURPRISE'];
const score = (s, name) => (s.scores ?? []).find((x) => EXPR[x.type] === name || x.type === name)?.confidence ?? 0;
const CUES = [
  { name: 'rest', text: 'POKER FACE: stay still and neutral', ms: 8000 },
  { name: 'smile', text: 'SMILE NOW', ms: 4000, kind: 'expression', match: (s) => rise(s, 'HAPPY') >= DELTA },
  { name: 'rest', text: 'POKER FACE', ms: 5000 },
  { name: 'blink', text: 'BLINK HARD, twice', ms: 3000, kind: 'blinking', match: (s) => s.detected },
  { name: 'rest', text: 'POKER FACE', ms: 5000 },
  { name: 'talk', text: 'SAY "I fold" OUT LOUD', ms: 3000, kind: 'talking', match: (s) => s.detected },
  { name: 'rest', text: 'POKER FACE', ms: 5000 },
  { name: 'surprise', text: 'LOOK SURPRISED', ms: 4000, kind: 'expression', match: (s) => rise(s, 'SURPRISE') >= DELTA },
  { name: 'rest', text: 'POKER FACE until the end', ms: Infinity },
];

const t0 = Date.now();
const now = () => Date.now() - t0;
const since = () => `${(now() / 1000).toFixed(2)}s`;
const frameSentAt = new Map(); // timestampUs -> ms since t0
const pipeline = []; // ms from frame sent to sample delivered
const validation = {};
const cueResults = [];
const rest = []; // expression samples during rest cues
const vitals = { pulse: [], breathing: [] };
const counts = { metricsEvents: 0, expression: 0, blinking: 0, talking: 0, landmarks: 0 };
let cue = null; let cueIdx = -1; let cueStart = 0;
// Baseline = mean score per class during the first rest cue (after 1.5 s), per player.
const baseSamples = []; let baseline = null;
const rise = (s, n) => (baseline ? score(s, n) - baseline[n] : -Infinity);
const exprLog = []; // every expression sample: { t, cue, scores }
const offsets = []; // arrival wall ms - sample timestampUs/1000 (constant part = clock offset, spread = latency jitter)
const tsProbe = { frameSent: [], sample: [], callback: [] };

function nextCue() {
  if (cue?.kind) cueResults.push({ cue: cue.name, latencyMs: cue.hitAt ?? null });
  if (cueIdx === 0 && baseSamples.length) {
    baseline = Object.fromEntries(EXPR.map((n) => [n, baseSamples.reduce((a, r) => a + r[n], 0) / baseSamples.length]));
    console.log(since(), 'baseline', JSON.stringify(Object.fromEntries(EXPR.map((n) => [n, +baseline[n].toFixed(1)]))));
  }
  cueIdx += 1; cue = { ...CUES[cueIdx] }; cueStart = now();
  console.log(`\n>>>>>>>>>>  ${cue.text}  <<<<<<<<<<\n`);
  if (Number.isFinite(cue.ms)) setTimeout(nextCue, cue.ms);
}

const metrics = [...faceMetrics, ...(PHASE === 'full' ? [...cardioMetrics, ...breathingMetrics] : [])];
const sdk = new SmartSpectraSDK({
  apiKey, requestedMetrics: metrics, enableTelemetry: false,
  ...(process.env.LOG_INFO ? { logLevel: SmartSpectraLogLevel.kInfo } : {}),
});

sdk.on('processingStatus', (s) => console.log(since(), 'processingStatus', s));
sdk.on('error', (code, message, retryable) => console.error(since(), 'error', code, message, 'retryable=', retryable));
sdk.on('frameSentThrough', (sent, ts) => {
  if (tsProbe.frameSent.length < 5) tsProbe.frameSent.push(ts);
  if (sent) frameSentAt.set(ts, now());
});
let lastHint = '';
sdk.on('validationStatus', (code, _ts, hint) => {
  validation[code] = (validation[code] ?? 0) + 1;
  if (hint !== lastHint) { console.log(since(), 'validation', code, hint ?? ''); lastHint = hint; }
});
sdk.on('metrics', (buf, cbTs) => {
  const arrived = now();
  counts.metricsEvents += 1;
  if (tsProbe.callback.length < 5) tsProbe.callback.push(cbTs);
  const m = decodeMetrics(buf);
  for (const kind of ['expression', 'blinking', 'talking', 'landmarks']) {
    for (const s of m.face?.[kind] ?? []) {
      counts[kind] += 1;
      if (kind === 'blinking') {
        if (tsProbe.sample.length < 5) tsProbe.sample.push(s.timestamp);
        offsets.push(Date.now() - Number(s.timestamp) / 1000);
      }
      if (kind === 'expression') {
        const scores = Object.fromEntries(EXPR.map((n) => [n, +score(s, n).toFixed(1)]));
        exprLog.push({ t: arrived, cue: cue?.name ?? 'warmup', cueIdx, scores });
        if (cueIdx === 0 && arrived - cueStart > 1500) baseSamples.push(scores);
      }
      const sent = frameSentAt.get(s.timestamp);
      if (sent !== undefined && kind !== 'landmarks') pipeline.push(arrived - sent);
      if (cue?.kind === kind && cue.hitAt === undefined && cue.match(s)) {
        cue.hitAt = arrived - cueStart;
        console.log(since(), `  hit ${cue.name} after ${cue.hitAt} ms`);
      }
      if (kind === 'expression' && cue?.name === 'rest' && cueIdx > 0 && arrived - cueStart > 1500) {
        rest.push(Object.fromEntries(EXPR.map((n) => [n, score(s, n)])));
      }
    }
  }
  for (const s of m.cardio?.pulseRate ?? []) vitals.pulse.push({ t: arrived, value: s.value, confidence: s.confidence, stable: s.stable });
  for (const s of m.breathing?.rate ?? []) vitals.breathing.push({ t: arrived, value: s.value, confidence: s.confidence, stable: s.stable });
  if (frameSentAt.size > 2000) frameSentAt.clear();
});

const pct = (xs, p) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
function restSummary() {
  const out = {};
  for (const n of EXPR) {
    const xs = rest.map((r) => r[n]);
    out[n] = { mean: xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null, p95: pct(xs, 0.95), max: xs.length ? Math.max(...xs) : null };
  }
  const over = (th) => (baseline ? rest.filter((r) => EXPR.some((n) => n !== 'NEUTRAL' && r[n] - baseline[n] >= th)).length : null);
  return { samples: rest.length, perClass: out, falseCrackSamples: { delta15: over(15), delta25: over(25), delta40: over(40) } };
}
// Peak rise above baseline per cue window, per class: how big is a deliberate crack?
function cuePeaks() {
  if (!baseline) return null;
  const out = [];
  for (let i = 1; i < CUES.length; i += 1) {
    const xs = exprLog.filter((e) => e.cueIdx === i);
    if (!xs.length) continue;
    const peak = Object.fromEntries(EXPR.map((n) => [n, +Math.max(...xs.map((e) => e.scores[n] - baseline[n])).toFixed(1)]));
    out.push({ cue: CUES[i].name, idx: i, samples: xs.length, peakRise: peak });
  }
  return out;
}

try {
  sdk.useCamera(camera ? CameraSelection.byId(camera.id) : CameraSelection.default);
  sdk.start();
} catch (err) { console.error(since(), 'start failed:', err.code, err.message); process.exit(1); }
console.log(since(), `phase=${PHASE}; camera=${camera?.name ?? 'default'}; fix your framing, cues start in ${WARMUP_MS / 1000}s; stops after ${RUN_MS / 1000}s`);
setTimeout(nextCue, WARMUP_MS);

setTimeout(async () => {
  if (cue?.kind) cueResults.push({ cue: cue.name, latencyMs: cue.hitAt ?? null });
  setTimeout(() => { console.error('stopAsync hung; forcing exit'); process.exit(3); }, 3_000).unref();
  await sdk.stopAsync(); await sdk.destroy();
  const result = {
    phase: PHASE, runMs: RUN_MS, date: new Date().toISOString(), counts, validation,
    pipelineMs: { n: pipeline.length, p50: pct(pipeline, 0.5), p95: pct(pipeline, 0.95), max: pipeline.length ? Math.max(...pipeline) : null },
    cueLatencyMs: cueResults, rest: restSummary(), delta: DELTA,
    baseline: baseline && Object.fromEntries(EXPR.map((n) => [n, +baseline[n].toFixed(1)])),
    cuePeaks: cuePeaks(), tsProbe,
    arrivalJitterMs: offsets.length ? (() => { const m = Math.min(...offsets); const d = offsets.map((o) => o - m); return { n: d.length, p50: +pct(d, 0.5).toFixed(1), p95: +pct(d, 0.95).toFixed(1), max: +Math.max(...d).toFixed(1), minOffsetMs: +m.toFixed(1) }; })() : null,
    vitals: {
      pulse: { n: vitals.pulse.length, firstAtMs: vitals.pulse[0]?.t ?? null, values: vitals.pulse.map((v) => v.value) },
      breathing: { n: vitals.breathing.length, firstAtMs: vitals.breathing[0]?.t ?? null, values: vitals.breathing.map((v) => v.value) },
    },
  };
  mkdirSync('results', { recursive: true });
  const file = `results/${PHASE}-${result.date.replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify(result, null, 2));
  writeFileSync(file.replace('.json', '-expressions.json'), JSON.stringify(exprLog));
  console.log(JSON.stringify({ ...result, tsProbe: undefined, vitals: { pulse: { ...result.vitals.pulse, values: undefined }, breathing: { ...result.vitals.breathing, values: undefined } } }, null, 2));
  console.log('saved', file);
  process.exit(0);
}, RUN_MS);
