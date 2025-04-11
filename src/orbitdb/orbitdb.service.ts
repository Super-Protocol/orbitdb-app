import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { identify } from '@libp2p/identify';
import { createHelia, HeliaLibp2p } from 'helia';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { tcp } from '@libp2p/tcp';
import {
  BaseDatabase,
  createOrbitDB,
  OpenDatabaseOptions,
  OrbitDB,
} from '@orbitdb/core';
import { ConfigService } from '../config/config.service.js';
import { Libp2p } from 'libp2p';
import {
  circuitRelayTransport,
  circuitRelayServer,
  // type CircuitRelayService,
} from '@libp2p/circuit-relay-v2';
import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';

import { FsBlockstore } from 'blockstore-fs';
import { FsDatastore } from 'datastore-fs';

@Injectable()
export class OrbitDBService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrbitDBService.name);
  private orbitdb: OrbitDB;
  private helia: HeliaLibp2p<Libp2p<Record<string, unknown>>>;
  private database: BaseDatabase;
  private isReady = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
    this.isReady = true;
  }

  async onModuleDestroy() {
    await this.disconnect();
    this.isReady = false;
  }

  async waitForReady() {
    if (!this.isReady) {
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }
  }

  async connect() {
    console.log('connect');
    try {
      // const keystore = await KeyStore({
      //   path: `${this.configService.orbitdbDirectory}/identies`,
      // });
      // console.log(keystore);
      const id = process.env.ID || 'userA';
      // const identity = await identities.createIdentity({ id });
      // const privateKey = await keystore.getKey(id);
      // console.log(privateKey);

      // // Создаем libp2p
      // const libp2p = await createLibp2p({
      //   transports: [tcp()],
      //   addresses: {
      //     listen: [
      //       `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsPort}`,
      //     ],
      //   },

      //   connectionEncrypters: [noise()],
      //   services: {
      //     pubsub: gossipsub({
      //       allowPublishToZeroTopicPeers: true,
      //       // D: 5,
      //       // Dhi: 12,
      //       // Dlo: 1,
      //     }),
      //     identify: identify(),
      //     // keychain:
      //   },
      //   privateKey,

      //   start: true,
      // });

      // const peerId = libp2p.peerId.toString();
      // console.log('Peer ID этой ноды:', peerId);

      const datastore = new FsDatastore(
        `${this.configService.orbitdbDirectory}/data-store`,
      );
      const blockstore = new FsBlockstore(
        `${this.configService.orbitdbDirectory}/block-store`,
      );

      this.helia = await createHelia({
        datastore,
        blockstore,

        libp2p: {
          addresses: {
            listen: [
              `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsPort}`,
              // '/ip4/0.0.0.0/udp/0/webrtc-direct',
              // '/ip6/::/tcp/0',
              // '/ip6/::/tcp/0/ws',
              // '/ip6/::/udp/0/webrtc-direct',
              '/p2p-circuit',
            ],
          },
          transports: [circuitRelayTransport(), webSockets(), tcp()],
          services: {
            relay: circuitRelayServer(),
            pubsub: gossipsub({
              allowPublishToZeroTopicPeers: true,
              // D: 5,
              // Dhi: 12,
              // Dlo: 1,
            }),
            identify: identify(),
          },
          // privateKey: await keystore.getKey(id),
        },
      });

      // this.helia.libp2p.peerStore.

      if (process.env.CONNECT_TO) {
        const connectTo = process.env.CONNECT_TO;
        console.log('connectTo', connectTo);
        await this.helia.libp2p.dial(multiaddr(connectTo));
      }

      // const identities = await Identities({ ipfs: this.helia, keystore });

      // console.log(await keystore.getKey(id));

      const addresses = this.helia.libp2p.getMultiaddrs();

      this.orbitdb = await createOrbitDB({
        ipfs: this.helia,
        directory: this.configService.orbitdbDirectory,

        // identity,
        // identities,
        id,
      });

      this.orbitdb.ipfs.libp2p.addEventListener('peer:connect', (peerId) => {
        console.log('peer:connect', peerId);
      });

      this.logger.log('OrbitDB успешно подключен', {
        addresses,
      });
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Ошибка подключения к OrbitDB: ${error.message}`,
        error.stack,
      );
      throw error;
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

        // sync: false,
        ...options,
      });

      database.events.on('join', (peerId, heads) => {
        console.log('join', peerId, heads);
      });

      this.logger.log(`Database '${name}'  opened successfully`);
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
