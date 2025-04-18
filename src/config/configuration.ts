export interface Config {
  nodeEnv: string;
  port: number;
  ipfs: {
    host: string;
    port: number;
    protocol: string;
  };
  orbitdb: {
    bootstrapNode?: string;
    directory: string;
    swarmKey: string;
  };
}

export default (): Config => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  ipfs: {
    host: process.env.IPFS_HOST || '0.0.0.0',
    port: parseInt(process.env.IPFS_PORT || '5001', 10),
    protocol: process.env.IPFS_PROTOCOL || 'http',
  },
  orbitdb: {
    bootstrapNode: process.env.BOOTSTRAP_NODE,
    directory: process.env.ORBITDB_DIRECTORY || './data/provider',
    swarmKey: process.env.SWARM_KEY!,
  },
});
