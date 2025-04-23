import { TunnelClient, TunnelClientOptions } from '@super-protocol/tunnels-lib';

import {
  readConfiguration,
  getDomainConfigs,
  TunnelsConfiguration,
} from '@super-protocol/solution-utils';
import { config } from './tunnel-config.js';

console.log('CONFIG:', config);

const run = async (): Promise<void> => {
  const configuration = await readConfiguration(config.configurationPath);
  const tunnelsConfiguration = configuration?.solution?.tunnels as
    | TunnelsConfiguration
    | undefined;

  const domainConfigs = await getDomainConfigs({
    tunnels: tunnelsConfiguration,
    blockchainUrl: config.blockchainUrl,
    contractAddress: config.blockchainContractAddress,
    inputDataFolder: config.inputDataFolder,
  });

  console.log(
    { domains: domainConfigs.map((config) => config.site.domain) },
    'Found tunnel client domain configs',
  );

  const options: TunnelClientOptions = {
    applicationPort: config.clientServerPort,
    localServerStartTimeout: config.localServerStartTimeoutMs,
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
