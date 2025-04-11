import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OfferService } from './offer.service.js';
import { OfferCreateDto } from './offer-create.dto.js';

@Controller('offer')
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post()
  async createOffer(@Body() offer: OfferCreateDto) {
    return this.offerService.createOffer(offer);
  }

  @Get(':id')
  async getOffer(@Param('id') id: string) {
    return this.offerService.getOffer(id);
  }
}
