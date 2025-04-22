import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { OfferModule } from './offer/offer.module.js';

@Module({
  imports: [AppConfigModule, ScheduleModule.forRoot(), OfferModule],
  providers: [],
})
export class AppModule {}
