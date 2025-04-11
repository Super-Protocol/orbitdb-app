import { Module } from '@nestjs/common';
import { OrbitDBModule } from '../orbitdb/orbitdb.module.js';
import { OfferController } from './offer.controller.js';
import { OfferService } from './offer.service.js';
import { IPFSAccessController } from '@orbitdb/core';

@Module({
  imports: [
    OrbitDBModule.forDatabase('offer', {
      AccessController: IPFSAccessController({ write: ['*'] }),
    }),
  ],
  controllers: [OfferController],
  providers: [OfferService],
  exports: [OfferService],
})
export class OfferModule {}
