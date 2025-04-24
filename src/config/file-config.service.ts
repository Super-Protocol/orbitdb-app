import * as fs from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { AppConfig, Config, configSchema } from './schema.js';
import configuration from './configuration.js';

@Injectable()
export class FileConfigService {
  private configPath: string;
  private config: Config | null = null;

  constructor() {
    this.configPath =
      process.env.CONFIG_PATH || '/sp/configurations/configuration.json';
  }

  async injectConfig(): Promise<AppConfig> {
    let configData: unknown;
    try {
      configData = await this.tryReadConfigFile();
    } catch {
      console.log(
        `No config file found at ${this.configPath}, using env configuration`,
      );
      configData = this.createConfigObject(configuration());
    }
    const config = await this.validateAndReturnConfig(configData);
    this.setEnvVariables(config);

    return config;
  }

  private async tryReadConfigFile(): Promise<unknown> {
    if (!this.configPath) {
      throw new Error('CONFIG_PATH is not set');
    }
    try {
      const rawData = await fs.readFile(this.configPath, 'utf-8');
      return this.parseConfigData(rawData);
    } catch (err) {
      console.error('Error reading configuration file:', err);
      throw new Error('Invalid configuration file');
    }
  }

  private parseConfigData(rawData: string): unknown {
    try {
      let configData = JSON.parse(rawData);
      if (!configData.solution) {
        configData = this.createConfigObject(configData);
      }
      return configData;
    } catch (err) {
      console.error('Error parsing configuration file:', err);
      throw new Error('Invalid JSON format in config file');
    }
  }

  private async validateAndReturnConfig(
    configData: unknown,
  ): Promise<AppConfig> {
    const validationResult = configSchema.safeParse(configData);
    if (!validationResult.success) {
      throw new Error('Invalid configuration');
    }
    const validConfig = validationResult.data;

    return validConfig.solution;
  }

  private setEnvVariables(validConfig: AppConfig): void {
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = validConfig.nodeEnv;
    }
    if (!process.env.IPFS_HOST) {
      process.env.IPFS_HOST = validConfig.ipfs.host;
    }
    if (!process.env.TCP_PORT) {
      process.env.TCP_PORT = validConfig.ipfs.tcpPort.toString();
    }
    if (!process.env.WS_PORT) {
      process.env.WS_PORT = validConfig.ipfs.wsPort.toString();
    }
    if (!process.env.BOOTSTRAP_NODES) {
      process.env.BOOTSTRAP_NODES = validConfig.orbitdb.bootstrapNodes;
    }
    if (!process.env.ORBITDB_DIRECTORY) {
      process.env.ORBITDB_DIRECTORY = validConfig.orbitdb.directory;
    }
    if (!process.env.PORT) {
      process.env.PORT = validConfig.port.toString();
    }
    if (!process.env.DEBUG) {
      process.env.DEBUG = validConfig.debug;
    }
  }

  private createConfigObject(appConfig: unknown): Config {
    return configSchema.parse({ solution: appConfig, data: [] });
  }
}
