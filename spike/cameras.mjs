// Lists cameras without creating an SDK session (no credits spent).
import { SmartSpectraSDK } from '@smartspectra/node-sdk';

console.log(JSON.stringify(SmartSpectraSDK.availableCameras(), null, 2));
