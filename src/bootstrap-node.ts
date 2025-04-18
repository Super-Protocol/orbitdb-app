import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { tls } from '@libp2p/tls';
import { preSharedKey } from '@libp2p/pnet';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { yamux } from '@chainsafe/libp2p-yamux';
import { ping } from '@libp2p/ping';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { autoNAT } from '@libp2p/autonat';
import * as fs from 'fs/promises';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { keys } from '@libp2p/crypto';
import { kadDHT } from '@libp2p/kad-dht';
import {
  circuitRelayServer,
  // type CircuitRelayService,
} from '@libp2p/circuit-relay-v2';
import { identify, identifyPush } from '@libp2p/identify';
import { dcutr } from '@libp2p/dcutr';

if (!process.env.SWARM_KEY) {
  console.error('SWARM_KEY is not set');
  process.exit(1);
}

const privateKeyFile = './keys.json';

export async function loadOrCreatePrivateKey() {
  try {
    const raw = await fs.readFile(privateKeyFile, 'utf-8');
    const json = JSON.parse(raw);
    const privKeyBytes = uint8ArrayFromString(
      json.privKey as string,
      'base64pad',
    );
    const privateKey = keys.privateKeyFromRaw(privKeyBytes);
    console.log('✅ Private key loaded from file');
    return privateKey;
  } catch {
    console.log('⚠️ Private key not found, creating new...');
    const key = await keys.generateKeyPair('Ed25519', 2048);
    const privKeyBytes = key.raw;
    await fs.writeFile(
      privateKeyFile,
      JSON.stringify(
        {
          privKey: uint8ArrayToString(privKeyBytes, 'base64pad'),
        },
        null,
        2,
      ),
    );
    console.log('✅ New private key saved to file');
    return key;
  }
}
const tcpPort = process.env.TCP_PORT || 4001;
const wsPort = process.env.WS_PORT || 4002;
const libp2p = await createLibp2p({
  privateKey: await loadOrCreatePrivateKey(),
  addresses: {
    listen: [
      `/ip4/0.0.0.0/tcp/${tcpPort}`,
      `/ip4/0.0.0.0/tcp/${wsPort}/ws`,
      '/p2p-circuit',
    ],
  },
  transports: [tcp(), webSockets()],
  connectionEncrypters: [noise(), tls()],
  streamMuxers: [yamux()],
  peerDiscovery: [
    pubsubPeerDiscovery({
      interval: 1000,
    }),
  ],

  services: {
    autoNAT: autoNAT(),
    relay: circuitRelayServer({}),
    ping: ping(),
    identify: identify(),
    pubsub: gossipsub({
      canRelayMessage: true,
    }),
    identifyPush: identifyPush(),
    dcutr: dcutr(),
    dht: kadDHT(),
  },
  connectionProtector: preSharedKey({
    psk: Buffer.from(process.env.SWARM_KEY, 'base64'),
  }),
});

await libp2p.start();

console.log('✅ Bootstrap + Relay node started!');
console.log('🆔 PeerId:', libp2p.peerId.toString());
console.log('🔗 Multiaddr:', libp2p.getMultiaddrs());

libp2p.addEventListener('peer:connect', (peerId) => {
  console.log('🔗 Connected peer:', peerId.detail.toString());
});

setInterval(() => {
  const peers = libp2p.getPeers();

  console.log(
    `PeerID: ${libp2p.peerId.toString()}, peers: ${JSON.stringify(peers)}`,
  );
}, 5000);
