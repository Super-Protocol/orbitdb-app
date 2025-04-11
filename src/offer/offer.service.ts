import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../orbitdb/inject-database.decorator.js';
import { Offer } from './types.js';
import { Database } from '../orbitdb/database.js';

@Injectable()
export class OfferService {
  constructor(@InjectDatabase('offer') private database: Database) {}

  async createOffer(offer: Omit<Offer, 'id'>) {
    const id = crypto.randomUUID();
    await this.database.put({ ...offer, _id: id });
    return { id, ...offer };
  }

  async getOffer(id: string): Promise<Offer | null> {
    const offer = await this.database.get(id);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const { _id, ...data } = offer;
    return { id: _id, ...data } as Offer;
  }
}
