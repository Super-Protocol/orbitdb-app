import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { identify, identifyPush } from '@libp2p/identify';
import { createHelia, HeliaLibp2p } from 'helia';
import { GossipSub, gossipsub } from '@chainsafe/libp2p-gossipsub';
import { tcp } from '@libp2p/tcp';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { httpGatewayRouting } from '@helia/routers';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { bitswap } from '@helia/block-brokers';
import {
  BaseDatabase,
  createOrbitDB,
  IPFSAccessController,
  OpenDatabaseOptions,
  OrbitDB,
} from '@orbitdb/core';
import { Libp2p } from 'libp2p';
import {
  circuitRelayTransport,
  circuitRelayServer,
} from '@libp2p/circuit-relay-v2';
import { autoNAT } from '@libp2p/autonat';
import { ping } from '@libp2p/ping';
import { uPnPNAT } from '@libp2p/upnp-nat';
import { LevelBlockstore } from 'blockstore-level';
import { preSharedKey } from '@libp2p/pnet';
import { DialOptions, PeerInfo } from '@libp2p/interface';
import { setTimeout } from 'node:timers/promises';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { AppConfigService } from '../config/config.service.js';

import { multiaddr} from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';

@Injectable()
export class OrbitDBService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrbitDBService.name);
  private orbitdb: OrbitDB;
  private helia: HeliaLibp2p<Libp2p<Record<string, unknown>>>;
  private database: BaseDatabase;
  private pubsub: GossipSub;
  private isReady = false;

  constructor(private configService: AppConfigService) {}

  async onModuleInit() {
    await this.connect();
    this.isReady = true;
  }

  async onModuleDestroy() {
    await this.disconnect();
    this.isReady = false;
  }

  async waitForReady() {
    while (!this.isReady) {
      await setTimeout(100);
    }
  }

  async connect() {
    try {
      const id = process.env.ID;

      const blockstore = new LevelBlockstore(
        `${this.configService.orbitdbDirectory}/block-store`,
      );

      this.helia = await createHelia({
        // datastore,
        blockstore,
        routers: [httpGatewayRouting()],
        blockBrokers: [
          bitswap({
            maxOutgoingMessageSize: 1024 * 1024 * 10,
            maxIncomingMessageSize: 1024 * 1024 * 10,
            maxInboundStreams: 100,
            maxOutboundStreams: 500,
          }),
        ],
        libp2p: {
          addresses: {
            listen: [
              `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsTcpPort}`,
              `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsWsPort}/wss`,
              '/p2p-circuit',
            ],
          },
          transports: [
            circuitRelayTransport({
            }),
            webSockets({
              websocket: {
                rejectUnauthorized: false,
              },
            }),
            tcp(),
            webRTC(),
          ],
          streamMuxers: [yamux()],
          peerDiscovery: [
            pubsubPeerDiscovery({
              interval: 5e3,
            }),
          ],
          connectionProtector: preSharedKey({
            psk: this.configService.swarmKey,
          }),
          connectionManager: {
          },
          services: {
            autoNAT: autoNAT(),
            pubsub: gossipsub({
              allowPublishToZeroTopicPeers: true,
            }),
            identify: identify(),
            identifyPush: identifyPush(),
            ping: ping(),
            upnp: uPnPNAT(),
          },
        },
      });

      this.pubsub = this.helia.libp2p.services.pubsub as GossipSub;

      this.helia.libp2p.addEventListener('peer:discovery', (evt) => {
        const peerIdStr = evt.detail.id.toString();
        const isBootstrap = (this.configService.bootstrapNodes || []).some(addrStr => {
          try {
            const ma = multiaddr(addrStr);
            return ma.getPeerId() === peerIdStr;
          } catch {
            return false;
          }
        });
        if (!isBootstrap && !this.helia.libp2p.getPeers().map(p => p.toString()).includes(peerIdStr)) {
          this.logger.log('Found peer: ', peerIdStr);
          void this.connectTo(evt.detail);
        } else {
          this.logger.log('Peer already connected or is bootstrap, skipping connect:', peerIdStr);
        }
      });

      const addresses = this.helia.libp2p.getMultiaddrs();

      this.orbitdb = await createOrbitDB({
        ipfs: this.helia,
        directory: this.configService.orbitdbDirectory,
        id,
      });

      this.orbitdb.ipfs.libp2p.addEventListener('peer:connect', (peerId) => {
        this.logger.log(`peer:connect`, {
          connectedPeer: peerId.detail.toString(),
        });
      });
      
      this.orbitdb.ipfs.libp2p.addEventListener('peer:disconnect', async (evt) => {
        const peerId = evt.detail.toString();
        this.logger.log(`peer:disconnect`, peerId);

        try {
          await this.helia.libp2p.peerStore.delete(peerIdFromString(peerId));
          this.logger.log(`Peer ${peerId} removed from peerStore after disconnect.`);
        } catch (err) {
          this.logger.warn(`Failed to remove peer ${peerId} from peerStore: ${err?.message}`);
        }

      });

      this.logger.log('OrbitDB successfully connected', {
        addresses,
      });

      setInterval(async () => {
        const allPeers = await this.helia.libp2p.peerStore.all();
        const peerInfos = allPeers.map(peer => {
          const peerId = peer.id.toString();
          const addrs = (peer.addresses || []).map(a => a.multiaddr.toString());
          return { peerId, multiaddrs: addrs };
        });

        console.log('Peers and their multiaddrs (from peerStore):');
        peerInfos.forEach(info => {
          console.log(`Peer: ${info.peerId}`);
          if (info.multiaddrs.length > 0) {
            info.multiaddrs.forEach(addr => console.log(`  ${addr}`));
          } else {
            console.log('  (no known multiaddrs)');
          }
        });
      }, 5000);

      // bootstrap nodes monitoring
      const monitorBootstrapNodes = () => {
        (this.configService.bootstrapNodes || []).forEach(async addrStr => {
          try {
            const ma = multiaddr(addrStr);
            const peerId = ma.getPeerId();
            if (!peerId) return;
            const peerIdStr = peerIdFromString(peerId.toString());

            if (this.helia.libp2p.getPeers().map(p => p.toString()).includes(peerIdStr.toString())) {
              return;
            }
            this.logger.log(`Connecting to bootstrap node ${peerIdStr}`);
            void this.connectTo({ id: peerIdStr, multiaddrs: [ma] } as PeerInfo);
          } catch {}
        });
      };
      // Run first iteration immediately
      monitorBootstrapNodes();
      // Then repeat every 5 seconds
      setInterval(monitorBootstrapNodes, 5000);


    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error connecting to OrbitDB: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async connectTo(peer: PeerInfo, options?: DialOptions) {
    try {
      await this.helia.libp2p.dial(peer.multiaddrs, options);
      this.logger.log(
        `Successfully connected to peer ${peer.id.toString()} via ${peer.multiaddrs.toString()}`,
      );
      return;
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to connect to peer: ${peer.id.toString()}, addreses: ${peer.multiaddrs.toString()}\n error:\n${error.message}`,
        error.stack,
      );
      return;
    }
  }

  async disconnect() {
    try {
      if (this.orbitdb) {
        await this.orbitdb.stop();
        this.logger.log('OrbitDB connection closed');
      }

      if (this.helia) {
        await this.helia.stop();
        this.logger.log('Helia node stopped');
      }

      if (this.database) {
        await this.database.close();
        this.logger.log('Database closed');
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Error during OrbitDB disconnect: ${error.message}`,
        error.stack,
      );
    }
  }

  async openDatabase(
    name: string,
    options?: OpenDatabaseOptions,
  ): Promise<BaseDatabase> {
    await this.waitForReady();
    if (!this.orbitdb) {
      throw new Error('OrbitDB not connected');
    }
    try {
      const database = await this.orbitdb.open(name, {
        type: 'documents',
        AccessController: IPFSAccessController(),

        sync: true,
        ...options,
      });

      this.logger.log(
        `Database ${name}: '${database.address}'  opened successfully`,
      );
      return database;
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to open database '${name}': ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async closeDatabase(database: BaseDatabase) {
    if (database) {
      await database.close();
      this.logger.log(`Database closed`);
    }
  }
}
