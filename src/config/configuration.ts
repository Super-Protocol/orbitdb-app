export interface Config {
  nodeEnv: string;
  port: number;
  ipfs: {
    host: string;
    tcpPort: number;
    wsPort: number;
    protocol: string;
  };
  orbitdb: {
    bootstrapNodes?: string;
    directory: string;
    swarmKey: string;
    databases: {
      offers: string;
    };
  };
}

export default (): Config => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  ipfs: {
    host: process.env.IPFS_HOST || '0.0.0.0',
    tcpPort: parseInt(process.env.TCP_PORT || '0', 10),
    wsPort: parseInt(process.env.WS_PORT || '0', 10),
    protocol: process.env.IPFS_PROTOCOL || 'http',
  },
  orbitdb: {
    bootstrapNodes: process.env.BOOTSTRAP_NODES,
    directory: process.env.ORBITDB_DIRECTORY || `./data/${crypto.randomUUID()}`,
    swarmKey: process.env.SWARM_KEY!,
    databases: {
      offers: process.env.OFFERS_DATABASE || 'offers',
    },
  },
});
