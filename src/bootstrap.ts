import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getOrGenerateSwarmKey } from './common/swarm-key.util.js';
import { FileConfigService } from './config/file-config.service.js';
import { bootstrap as bootstrapNode } from './bootstrap-node.js';
import { AppConfig, bootstrapConfigSchema } from './config/schema.js';
import { INestApplication } from '@nestjs/common';

export class AppBootstrap {
  private configService: FileConfigService;

  constructor() {
    this.configService = new FileConfigService();
  }

  public async start(): Promise<void> {
    try {
      const config = await this.configService.injectConfig();
      console.log('ENVS:', process.env);
      await this.setSwarmKeyEnvironment();
      await this.launchApplication(config);
    } catch (err) {
      console.error('Failed to start application:', err);
      process.exit(1);
    }
  }

  private async setSwarmKeyEnvironment(): Promise<void> {
    const swarmKey = await getOrGenerateSwarmKey();
    process.env.SWARM_KEY = swarmKey;
    console.log(`✅ Swarm key set to ${swarmKey}`);
  }

  private async launchApplication(config: AppConfig): Promise<void> {
    if (config.runMode === 'bootstrap') {
      await this.launchBootstrapMode(config);
    } else {
      await this.launchNodeMode(config);
    }
  }

  private async launchBootstrapMode(appConfig: AppConfig): Promise<void> {
    console.log('Starting in bootstrap mode...');
    const bootstrapConfig = this.ensureValidBootstrapConfig(appConfig);
    process.env.TCP_PORT = bootstrapConfig.ipfs.tcpPort.toString();
    process.env.WS_PORT =
      process.env.HTTPS_PORT || bootstrapConfig.ipfs.wsPort.toString();
    await bootstrapNode();
  }

  private async launchNodeMode(appConfig: AppConfig): Promise<void> {
    console.log('Starting in node mode...');

    process.env.PORT = process.env.HTTPS_PORT || appConfig.port.toString();

    const app = await NestFactory.create(AppModule);
    this.setupSwagger(app);
    await app.listen(appConfig.port);
    console.log(`✅ Application started on port ${appConfig.port}`);
  }

  private setupSwagger(app: INestApplication): void {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API Documentation')
      .setDescription('API description')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  private ensureValidBootstrapConfig(config: AppConfig): AppConfig {
    const bootstrapInput = { ...config, runMode: 'bootstrap' as const };
    const validatedConfig = bootstrapConfigSchema.parse(bootstrapInput);
    console.log('Valid bootstrap configuration detected');
    return validatedConfig;
  }
}
