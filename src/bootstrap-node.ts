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
import { webRTC } from '@libp2p/webrtc';
import { mplex } from '@libp2p/mplex';
import {
  circuitRelayServer,
  circuitRelayTransport,
  // type CircuitRelayService,
} from '@libp2p/circuit-relay-v2';
import { identify, identifyPush } from '@libp2p/identify';
import { dcutr } from '@libp2p/dcutr';

const privateKeyFile = process.env.PRIVATE_KEY_FILE || './keys.json';

export async function loadOrCreatePrivateKey() {
  try {
    let rawBase64encoded: string;

    if (process.env.PRIVATE_KEY) {
      rawBase64encoded = process.env.PRIVATE_KEY;
    } else {
      const raw = await fs.readFile(privateKeyFile, 'utf-8');
      const json = JSON.parse(raw);
      rawBase64encoded = json.privKey as string;
    }
    const privKeyBytes = uint8ArrayFromString(rawBase64encoded, 'base64pad');
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

export async function bootstrap() {
  if (!process.env.SWARM_KEY) {
    console.error('SWARM_KEY is not set');
    process.exit(1);
  }

  // const tcpPort = process.env.TCP_PORT || 4001;
  const wsPort = process.env.WS_PORT || 4002;
  const libp2p = await createLibp2p({
    privateKey: await loadOrCreatePrivateKey(),
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${wsPort}/wss`, '/p2p-circuit', '/webrtc'],
    },
    transports: [
      tcp(),
      webSockets({
        https: {
          key: process.env.TLS_KEY,
          cert: process.env.TLS_CERT,
          rejectUnauthorized: false,
        },
      }),
      circuitRelayTransport(),
      webRTC({
        rtcConfiguration: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
          ],
        },
      }),
    ],
    connectionEncrypters: [noise(), tls()],
    streamMuxers: [yamux(), mplex()],
    peerDiscovery: [
      pubsubPeerDiscovery({
        interval: 1000,
      }),
    ],
    connectionManager: {
      // inboundUpgradeTimeout: 10000,
      // outboundUpgradeTimeout: 10000,
      // outboundStreamProtocolNegotiationTimeout: 10000,
      // inboundStreamProtocolNegotiationTimeout: 10000,
    },
    services: {
      autoNAT: autoNAT(),
      relay: circuitRelayServer(),
      ping: ping(),
      identify: identify(),
      pubsub: gossipsub({
        doPX: true,
        canRelayMessage: true,
        allowPublishToZeroTopicPeers: true,
      }),
      identifyPush: identifyPush(),
      dcutr: dcutr(),
      dht: kadDHT({
        clientMode: false,
      }),
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

  return libp2p;
}

// Прямой запуск, если файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((err) => {
    console.error('Failed to start bootstrap node:', err);
    process.exit(1);
  });
}
