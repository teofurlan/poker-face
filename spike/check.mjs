// Minimal webcam check: opens the camera, authenticates, logs the first metrics,
// then stops on its own after RUN_MS to keep credit use to a minimum.
import {
  SmartSpectraSDK, CameraSelection, SmartSpectraLogLevel, cardioMetrics, faceMetrics, decodeMetrics,
} from '@smartspectra/node-sdk';

const RUN_MS = Number(process.env.RUN_MS ?? 15_000);
const apiKey = process.env.PRESAGE_API_KEY;
if (!apiKey) {
  console.error('PRESAGE_API_KEY is not set');
  process.exit(2);
}

// Select by name inside Node: Git Bash mangles `\\?\...` device IDs passed as arguments.
const cameraName = process.argv[2];
const camera = cameraName
  ? SmartSpectraSDK.availableCameras().find((c) => c.name.includes(cameraName))
  : undefined;
if (cameraName && !camera) {
  console.error('camera not found:', cameraName);
  process.exit(2);
}
console.log('camera:', camera?.name ?? 'default');
const t0 = Date.now();
const since = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
let metricsCount = 0;
const faceCounts = { expression: 0, blinking: 0, talking: 0, landmarks: 0 };
let pulseSamples = 0;
const detectedTrue = { blinking: 0, talking: 0 };
let firstFaceAt = null;

const sdk = new SmartSpectraSDK({
  apiKey,
  requestedMetrics: [...cardioMetrics, ...faceMetrics],
  enableTelemetry: false,
  ...(process.env.LOG_INFO ? { logLevel: SmartSpectraLogLevel.kInfo } : {}),
});

sdk.on('processingStatus', (s) => console.log(since(), 'processingStatus', s));
sdk.on('validationStatus', (code, _ts, hint) => console.log(since(), 'validation', code, hint ?? ''));
sdk.on('metrics', (buf) => {
  metricsCount += 1;
  const m = decodeMetrics(buf);
  for (const k of Object.keys(faceCounts)) faceCounts[k] += m.face?.[k]?.length ?? 0;
  pulseSamples += m.cardio?.pulseRate?.length ?? 0;
  for (const k of Object.keys(detectedTrue)) {
    detectedTrue[k] += (m.face?.[k] ?? []).filter((s) => s.detected).length;
  }
  const expr = m.face?.expression?.at(-1);
  if (expr && firstFaceAt === null) {
    firstFaceAt = since();
    console.log(since(), 'first expression sample', JSON.stringify(expr.scores));
  }
  if (metricsCount % 30 === 0) {
    console.log(since(), 'metrics', metricsCount, 'face', JSON.stringify(faceCounts), 'pulse samples', pulseSamples);
  }
});
sdk.on('error', (code, message, retryable) => console.error(since(), 'error', code, message, 'retryable=', retryable));

try {
  sdk.useCamera(camera ? CameraSelection.byId(camera.id) : CameraSelection.default);
  sdk.start();
} catch (err) {
  console.error(since(), 'start failed:', err.code, err.message);
  process.exit(1);
}
console.log(since(), 'started; stopping after', RUN_MS / 1000, 's');

setTimeout(async () => {
  console.log(since(), 'stopping; metrics so far:', metricsCount);
  // Hard guard: never leave a billed session running if stop hangs.
  setTimeout(() => {
    console.error(since(), 'stopAsync hung; forcing exit');
    process.exit(3);
  }, 3_000).unref();
  await sdk.stopAsync();
  await sdk.destroy();
  console.log(since(), 'stopped; metrics events received:', metricsCount);
  console.log('face samples:', JSON.stringify(faceCounts), 'first expression at:', firstFaceAt, 'pulse samples:', pulseSamples);
  console.log('detected=true samples:', JSON.stringify(detectedTrue));
  process.exit(0);
}, RUN_MS);
