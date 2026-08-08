import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SetShippingRateDto } from './dto/set-shipping-rate.dto';
import { ShippingRate } from './shipping-rate.entity';

/** The single flat delivery charge (India-only), managed by admins. */
@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingRate)
    private readonly rates: Repository<ShippingRate>,
  ) {}

  /** The current delivery charge, or null if none is configured yet. */
  get(): Promise<ShippingRate | null> {
    return this.rates.findOne({ where: {}, order: { id: 'ASC' } });
  }

  /** Upsert the single flat delivery charge (admin). */
  async upsert(dto: SetShippingRateDto): Promise<ShippingRate> {
    const existing = await this.get();
    const row = existing ?? this.rates.create();
    row.amountMinor = dto.amountMinor;
    return this.rates.save(row);
  }
}
