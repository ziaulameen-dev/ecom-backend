import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Address } from './address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/** User-scoped shipping addresses. Every method is bound to a userId. */
@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addresses: Repository<Address>,
  ) {}

  list(userId: string): Promise<Address[]> {
    return this.addresses.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async get(userId: string, id: string): Promise<Address> {
    const address = await this.addresses.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addresses.count({ where: { userId } });
    // First address is default; otherwise honour the flag.
    const isDefault = count === 0 ? true : !!dto.isDefault;
    const address = await this.addresses.save(
      this.addresses.create({
        ...dto,
        country: 'IN', // India-only store
        userId,
        isDefault,
      }),
    );
    if (isDefault) await this.clearOtherDefaults(userId, address.id);
    return address;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    const address = await this.get(userId, id);
    Object.assign(address, dto);
    const saved = await this.addresses.save(address);
    if (dto.isDefault) await this.clearOtherDefaults(userId, id);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.get(userId, id);
    await this.addresses.delete({ id, userId });
    // If we removed the default, promote the most recent remaining address.
    if (address.isDefault) {
      const next = await this.addresses.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      if (next) {
        next.isDefault = true;
        await this.addresses.save(next);
      }
    }
  }

  private clearOtherDefaults(userId: string, keepId: string): Promise<unknown> {
    return this.addresses.update(
      { userId, id: Not(keepId) },
      { isDefault: false },
    );
  }
}
