import { AppConfig } from './schema.js';

export default (): AppConfig => {
  return {
    nodeEnv: process.env.NODE_ENV as 'development' | 'production' | 'test',
    port: parseInt(process.env.PORT || '3000', 10),
    runMode: (process.env.RUN_MODE as 'node' | 'bootstrap') || 'node',
    debug: process.env.DEBUG || '',
    ipfs: {
      host: process.env.IPFS_HOST || '0.0.0.0',
      tcpPort: parseInt(process.env.TCP_PORT || '4001', 10),
      wsPort: parseInt(process.env.WS_PORT || '4002', 10),
    },
    orbitdb: {
      bootstrapNodes: process.env.BOOTSTRAP_NODES,
      directory:
        process.env.ORBITDB_DIRECTORY || `./data/${crypto.randomUUID()}`,
      swarmKey: process.env.SWARM_KEY,
      databases: {
        offers: process.env.OFFERS_DATABASE || 'offers',
      },
    },
  };
};
