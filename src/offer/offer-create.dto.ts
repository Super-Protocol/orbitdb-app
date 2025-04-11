import { IsNotEmpty, IsString } from 'class-validator';
import { Offer } from './types.js';
import { ApiProperty } from '@nestjs/swagger';
export class OfferCreateDto implements Omit<Offer, 'id'> {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Title of the offer' })
  title: string;

  @IsString()
  @ApiProperty({ description: 'Description of the offer', required: false })
  description?: string | undefined;
}
