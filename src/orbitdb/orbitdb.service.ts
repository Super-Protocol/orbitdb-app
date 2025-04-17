import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { identify, identifyPush } from '@libp2p/identify';
import { createHelia, HeliaLibp2p } from 'helia';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { tcp } from '@libp2p/tcp';
import { mdns } from '@libp2p/mdns';
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client';
import { delegatedHTTPRoutingDefaults } from '@helia/routers';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht';
import { ipnsSelector } from 'ipns/selector';
import { ipnsValidator } from 'ipns/validator';

import { httpGatewayRouting, libp2pRouting } from '@helia/routers';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import {
  BaseDatabase,
  createOrbitDB,
  IPFSAccessController,
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
import { dcutr } from '@libp2p/dcutr';
import { autoTLS } from '@ipshipyard/libp2p-auto-tls';
import { autoNAT } from '@libp2p/autonat';
import { keychain } from '@libp2p/keychain';
// import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';
import { ping } from '@libp2p/ping';

import { bootstrap } from '@libp2p/bootstrap';
import { uPnPNAT } from '@libp2p/upnp-nat';

import { LevelBlockstore } from 'blockstore-level';
// import { LevelDatastore } from 'datastore-level';
import { preSharedKey } from '@libp2p/pnet';

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

      // const datastore = new LevelDatastore(
      //   `${this.configService.orbitdbDirectory}/data-store`,
      // );
      const blockstore = new LevelBlockstore(
        `${this.configService.orbitdbDirectory}/block-store`,
      );

      this.helia = await createHelia({
        // datastore,
        blockstore,
        routers: [httpGatewayRouting()],
        libp2p: {
          addresses: {
            listen: [
              // '/ip4/0.0.0.0/tcp/0',
              // '/ip4/0.0.0.0/tcp/0/ws',
              // '/ip4/0.0.0.0/udp/0/webrtc-direct',
              // '/ip6/::/tcp/0',
              // '/ip6/::/tcp/0/ws',
              // '/ip6/::/udp/0/webrtc-direct',
              // '/p2p-circuit',
              `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsPort}`,
              // `/ip4/${this.configService.ipfsHost}/udp/0`,
              // '/ip6/::/tcp/0',
              // // '/ip4/0.0.0.0/udp/0/webrtc-direct',
              // // '/ip6/::/tcp/0',
              // // '/ip6/::/tcp/0/ws',
              // // '/ip6/::/udp/0/webrtc-direct',
              '/p2p-circuit',
            ],
            announce: [
              `/ip4/${this.configService.ipfsHost}/tcp/${this.configService.ipfsPort}`,
            ],
          },
          transports: [circuitRelayTransport(), tcp()],
          streamMuxers: [yamux()],
          peerDiscovery: [
            pubsubPeerDiscovery({
              interval: 1000,
            }),
            // mdns(),
            bootstrap({
              list: [
                `/ip4/127.0.0.1/tcp/4001/p2p/12D3KooWJCXMtWatBTmhhRP58NDHoQD38kqhgUV6HxMrQTRys9kG`,
              ],
              // list: [
              //   // '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
              //   // '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
              //   // '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
              //   // '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
              //   // '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
              //   // '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
              // ],
            }),
          ],
          connectionProtector: preSharedKey({
            psk: this.configService.swarmKey,
          }),
          connectionManager: {},
          // connectionManager: {
          //   // autoDial: true,
          //   // allow: [],
          // },
          services: {
            // autoNAT: autoNAT(),
            // autoTLS: autoTLS(),
            // dcutr: dcutr(),
            relay: circuitRelayServer(),
            pubsub: gossipsub({
              // allowPublishToZeroTopicPeers: true,
              // D: 5,
              // Dhi: 12,
              // Dlo: 1,
            }),
            // delegatedRouting: () =>
            //   createDelegatedRoutingV1HttpApiClient('http://127.0.0.1:8080'),
            // dht: kadDHT({
            //   clientMode: false,
            //   protocol: '/ipfs/lan/kad/1.0.0',
            //   peerInfoMapper: removePublicAddressesMapper,
            //   // querySelfInterval: 1000,
            //   // selectors: {
            //   //   ipns: ipnsSelector,
            //   // },
            //   // validators: {
            //   //   ipns: ipnsValidator,
            //   // },
            // }),
            identify: identify(),
            identifyPush: identifyPush(),
            ping: ping(),
            // keychain: keychain({
            //   pass: '12345678901234567890',
            // }),
            // upnp: uPnPNAT({
            //   externalAddress: '127.0.0.1',
            // }),
          },
          // privateKey: await keystore.getKey(id),
        },
      });

      // this.helia.libp2p.peerStore.all({
      //   filters: [(q) => q.],
      // });

      // this.helia.libp2p.peerStore.forEach((peer) => {
      //   void this.helia.libp2p.dial(peer.id).catch((err) => {
      //     this.logger.error('error', err);
      //   });
      // });

      if (process.env.CONNECT_TO) {
        const connectTo = process.env.CONNECT_TO;
        console.log('connectTo', connectTo);
        await this.helia.libp2p.dial(multiaddr(connectTo));
      }

      this.helia.libp2p.addEventListener('peer:discovery', (evt) => {
        console.log('found peer: ', evt.detail.id.toString());
        this.helia.libp2p.dial(evt.detail.id);
        // this.helia.libp2p.dial(evt.detail.multiaddrs).then((peer) => {
        //   console.log('peer', peer);
        // });
      });

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
        this.logger.debug(`peer:connect`, peerId.detail.toString());
      });
      this.orbitdb.ipfs.libp2p.addEventListener('peer:disconnect', (peerId) => {
        this.logger.debug(`peer:disconnect`, peerId.detail);
      });

      this.orbitdb.ipfs.libp2p.addEventListener(
        'certificate:provision',
        (peerId) => {
          console.log('certificate:provision', peerId.detail);
        },
      );

      this.logger.log('OrbitDB успешно подключен', {
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
        AccessController: IPFSAccessController(),

        // sync: false,
        ...options,
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
