import { generateKey } from '@libp2p/pnet';

const swarmKey = new Uint8Array(95);
generateKey(swarmKey);

console.log(Buffer.from(swarmKey).toString('base64'));
