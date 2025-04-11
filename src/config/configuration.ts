export interface Config {
  nodeEnv: string;
  port: number;
  ipfs: {
    host: string;
    port: number;
    protocol: string;
  };
  orbitdb: {
    directory: string;
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
    directory: process.env.ORBITDB_DIRECTORY || './orbitdb',
  },
  // Здесь можно добавить другие параметры конфигурации
});
