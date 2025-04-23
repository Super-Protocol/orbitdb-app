import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

if (!process.env.BLOCKCHAIN_URL) {
  throw new Error('BLOCKCHAIN_URL is not set');
}

if (!process.env.BLOCKCHAIN_CONTRACT_ADDRESS) {
  throw new Error('BLOCKCHAIN_CONTRACT_ADDRESS is not set');
}

export const config = {
  appName: 'orbit-app',
  appVersion: '0.0.1',
  blockchainUrl: process.env.BLOCKCHAIN_URL,
  blockchainContractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
  logLevel: (process.env.LOG_LEVEL as string) || 'trace',
  inputDataFolder: (process.env.INPUT_DATA_FOLDER as string) || '/sp/inputs',
  secretsDataFolder:
    (process.env.SECRETS_DATA_FOLDER as string) || '/sp/secrets',
  certFileName: (process.env.CERT_FILE_NAME as string) || 'certificate.crt',
  certPrivateKeyFileName:
    (process.env.CERT_PRIVATE_KEY_FILE_NAME as string) || 'private.pem',
  configFileName: 'tunnel-client-config.json',
  configSearchFolderDepth: 1 as number,
  clientServerPort: 9000,
  serverFilePath: path.join(import.meta.dirname, './main.js'),
  configurationPath:
    process.env.CONFIGURATION_PATH || '/sp/configurations/configuration.json',
  localServerStartTimeoutMs: Number.parseInt(
    process.env.LOCAL_SERVER_START_TIMEOUT_MS || '900000',
  ), // 15 min
};
