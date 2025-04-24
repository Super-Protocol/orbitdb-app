import {
  TunnelClient,
  TunnelClientOptions,
  findConfigsRecursive,
} from '@super-protocol/tunnels-lib';
import { pino } from 'pino';
import { config } from './tunnel-config.js';

const logger = pino({
  level: 'trace',
}).child({
  app: config.appName,
  version: config.appVersion,
});

const run = async (): Promise<void> => {
  const domainConfigs = await findConfigsRecursive(
    config.inputDataFolder,
    'config.json',
  );

  console.log(
    { domains: domainConfigs.map((config) => config.site.domain) },
    'Found tunnel client domain configs',
  );

  const options: TunnelClientOptions = {
    applicationPort: config.clientServerPort,
    localServerStartTimeout: config.localServerStartTimeoutMs,
    logger,
  };
  const tunnelClient = new TunnelClient(
    config.serverFilePath,
    domainConfigs,
    options,
  );
  await tunnelClient.start();
};

run().catch((err) => {
  console.error(`Failed to start application: ${err}`);
  process.exit(1);
});
