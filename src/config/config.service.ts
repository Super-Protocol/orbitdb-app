import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Config } from './configuration.js';

@Injectable()
export class ConfigService {
  private keyPath = './keys/libp2p-ed25519.key';

  constructor(private configService: NestConfigService<Config>) {}

  get nodeEnv(): string {
    return this.configService.get<string>('nodeEnv') || 'development';
  }

  get port(): number {
    return this.configService.get<number>('port') || 3000;
  }

  get ipfsHost(): string {
    return this.configService.get<Config['ipfs']>('ipfs')?.host || '127.0.0.1';
  }

  get ipfsPort(): number {
    return this.configService.get<Config['ipfs']>('ipfs')?.port || 5001;
  }

  get ipfsProtocol(): string {
    return this.configService.get<Config['ipfs']>('ipfs')?.protocol || 'http';
  }

  get orbitdbDirectory(): string {
    return (
      this.configService.get<Config['orbitdb']>('orbitdb')?.directory ||
      './orbitdb'
    );
  }

  get swarmKey(): Uint8Array<ArrayBuffer> {
    return Buffer.from(
      this.configService.get<Config['orbitdb']>('orbitdb')!.swarmKey,
      'base64',
    );
  }

  get bootstrapNode(): string | undefined {
    return this.configService.get<Config['orbitdb']>('orbitdb')?.bootstrapNode;
  }
}
