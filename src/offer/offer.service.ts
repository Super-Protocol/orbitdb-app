import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../orbitdb/inject-database.decorator.js';
import { Offer } from './types.js';
import { Database } from '../orbitdb/database.js';

@Injectable()
export class OfferService {
  constructor(@InjectDatabase('offer') private database: Database<Offer>) {}

  async createOffer(offer: Omit<Offer, 'id'>) {
    const id = crypto.randomUUID();
    await this.database.put({ ...offer, id });
    return { id, ...offer };
  }

  async getOffer(id: string): Promise<Offer | null> {
    const offer = await this.database.get(id);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }

  async getOffers(): Promise<Offer[]> {
    return this.database.all();
  }

  async deleteOffer(id: string) {
    await this.database.del(id);
  }
}
