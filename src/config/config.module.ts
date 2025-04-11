import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration.js';
import { validate } from './env.validation.js';
import { ConfigService } from './config.service.js';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      cache: true,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
