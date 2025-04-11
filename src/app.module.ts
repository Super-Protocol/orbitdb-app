import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { OfferModule } from './offer/offer.module.js';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), OfferModule],
  providers: [],
})
export class AppModule {}
