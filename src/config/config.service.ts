import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './schema.js';

@Injectable()
export class AppConfigService {
  private keyPath = './keys/libp2p-ed25519.key';

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  get nodeEnv(): string {
    return this.configService.get<string>('nodeEnv') || 'development';
  }

  get port(): number {
    return this.configService.get<number>('port') || 3000;
  }

  get ipfsHost(): string {
    return (
      this.configService.get<AppConfig['ipfs']>('ipfs')?.host || '127.0.0.1'
    );
  }

  get ipfsTcpPort(): number {
    return this.configService.get<AppConfig['ipfs']>('ipfs')!.tcpPort;
  }

  get ipfsWsPort(): number {
    return this.configService.get<AppConfig['ipfs']>('ipfs')!.wsPort;
  }

  get orbitdbDirectory(): string {
    return (
      this.configService.get<AppConfig['orbitdb']>('orbitdb')?.directory ||
      './orbitdb'
    );
  }

  get swarmKey(): Uint8Array {
    return Buffer.from(
      this.configService.get<AppConfig['orbitdb']>('orbitdb')!.swarmKey || '',
      'base64',
    );
  }

  get bootstrapNodes(): string[] | undefined {
    return this.configService
      .get<AppConfig['orbitdb']>('orbitdb')
      ?.bootstrapNodes?.split(',');
  }

  get databases(): Record<string, string> {
    return (
      this.configService.get<AppConfig['orbitdb']>('orbitdb')?.databases || {}
    );
  }
}
