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
import { dcutr } from '@libp2p/dcutr';
import { autoNAT } from '@libp2p/autonat';
import { ping } from '@libp2p/ping';
import { bootstrap } from '@libp2p/bootstrap';
import { uPnPNAT } from '@libp2p/upnp-nat';
import { LevelBlockstore } from 'blockstore-level';
import { preSharedKey } from '@libp2p/pnet';
import { DialOptions, PeerInfo } from '@libp2p/interface';
import { setTimeout } from 'node:timers/promises';
import { webSockets } from '@libp2p/websockets';
import { kadDHT } from '@libp2p/kad-dht';
import { webRTC } from '@libp2p/webrtc';
import { AppConfigService } from '../config/config.service.js';

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
              `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsWsPort}/ws`,
              '/p2p-circuit',
              '/webrtc',
            ],
          },
          transports: [circuitRelayTransport(), webSockets(), tcp(), webRTC()],
          streamMuxers: [yamux(), mplex()],
          peerDiscovery: [
            pubsubPeerDiscovery({
              interval: 5e3,
            }),
            ...(this.configService.bootstrapNodes
              ? [
                  bootstrap({
                    list: this.configService.bootstrapNodes,
                  }),
                ]
              : []),
          ],
          connectionProtector: preSharedKey({
            psk: this.configService.swarmKey,
          }),
          connectionManager: {
            // reconnectRetries: Infinity,
          },
          services: {
            autoNAT: autoNAT(),
            dcutr: dcutr(),
            relay: circuitRelayServer(),
            pubsub: gossipsub({
              allowPublishToZeroTopicPeers: true,
            }),
            identify: identify(),
            identifyPush: identifyPush(),
            ping: ping(),
            dht: kadDHT({
              clientMode: false,
            }),
            upnp: uPnPNAT(),
          },
        },
      });

      this.pubsub = this.helia.libp2p.services.pubsub as GossipSub;

      this.helia.libp2p.addEventListener('peer:discovery', (evt) => {
        this.logger.log('Found peer: ', evt.detail.id.toString());
        void this.connectTo(evt.detail);
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
      this.orbitdb.ipfs.libp2p.addEventListener('peer:disconnect', (peerId) => {
        this.logger.log(`peer:disconnect`, peerId.detail);
      });

      this.logger.log('OrbitDB successfully connected', {
        addresses,
      });

      setInterval(() => {
        const peers = this.helia.libp2p.getPeers();

        console.log(
          `PeerID: ${this.orbitdb.ipfs.libp2p.peerId.toString()}, peers: ${JSON.stringify(peers)}`,
        );
      }, 2000);
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
