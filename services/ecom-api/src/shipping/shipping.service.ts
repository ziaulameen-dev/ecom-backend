import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SetShippingRateDto } from './dto/set-shipping-rate.dto';
import { ShippingRate } from './shipping-rate.entity';

/** Per-country delivery charges, managed by admins. */
@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingRate)
    private readonly rates: Repository<ShippingRate>,
  ) {}

  /** The delivery charge for a country, or null if none is configured. */
  getForCountry(country: string): Promise<ShippingRate | null> {
    return this.rates.findOne({ where: { country: country.toUpperCase() } });
  }

  list(): Promise<ShippingRate[]> {
    return this.rates.find({ order: { country: 'ASC' } });
  }

  /** Upsert the delivery charge for one country (admin). */
  async upsert(dto: SetShippingRateDto): Promise<ShippingRate> {
    const country = dto.country.toUpperCase();
    const existing = await this.rates.findOne({ where: { country } });
    const row = existing ?? this.rates.create({ country });
    row.currency = dto.currency.toLowerCase();
    row.amountMinor = dto.amountMinor;
    return this.rates.save(row);
  }

  async remove(country: string): Promise<void> {
    const res = await this.rates.delete({ country: country.toUpperCase() });
    if (!res.affected) throw new NotFoundException('Shipping rate not found');
  }
}
