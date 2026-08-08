import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';
import { Coupon } from './coupon.entity';

/** The result of validating a coupon against a subtotal. */
export interface CouponResult {
  code: string;
  type: Coupon['type'];
  discountMinor: number;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly coupons: Repository<Coupon>,
  ) {}

  /** Validate a code for a subtotal; throws with a clear reason if unusable. */
  async validate(code: string, subtotalMinor: number): Promise<CouponResult> {
    const coupon = await this.coupons.findOne({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon || !coupon.active) {
      throw new BadRequestException('Invalid coupon code');
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This coupon has expired');
    }
    if (
      coupon.maxRedemptions != null &&
      coupon.timesRedeemed >= coupon.maxRedemptions
    ) {
      throw new BadRequestException('This coupon is no longer available');
    }
    if (subtotalMinor < coupon.minSubtotalMinor) {
      throw new BadRequestException(
        `Add ${((coupon.minSubtotalMinor - subtotalMinor) / 100).toFixed(0)} more to use this coupon`,
      );
    }
    return {
      code: coupon.code,
      type: coupon.type,
      discountMinor: this.discountFor(coupon, subtotalMinor),
    };
  }

  /** Discount amount (paise), never exceeding the subtotal. */
  discountFor(coupon: Coupon, subtotalMinor: number): number {
    let d =
      coupon.type === 'percent'
        ? Math.round((subtotalMinor * coupon.value) / 100)
        : coupon.value;
    if (coupon.type === 'percent' && coupon.maxDiscountMinor != null) {
      d = Math.min(d, coupon.maxDiscountMinor);
    }
    return Math.min(d, subtotalMinor);
  }

  /** Atomically count a redemption (called at checkout). */
  async redeem(code: string): Promise<void> {
    await this.coupons.increment({ code: code.toUpperCase() }, 'timesRedeemed', 1);
  }

  // ---- Admin ----------------------------------------------------------------

  list(): Promise<Coupon[]> {
    return this.coupons.find({ order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const code = dto.code.toUpperCase();
    if (await this.coupons.findOne({ where: { code } })) {
      throw new BadRequestException(`Coupon "${code}" already exists`);
    }
    if (dto.type === 'percent' && dto.value > 100) {
      throw new BadRequestException('Percent value cannot exceed 100');
    }
    return this.coupons.save(
      this.coupons.create({
        ...dto,
        code,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.coupons.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if ((dto.type ?? coupon.type) === 'percent' && (dto.value ?? coupon.value) > 100) {
      throw new BadRequestException('Percent value cannot exceed 100');
    }
    Object.assign(coupon, dto);
    if (dto.expiresAt !== undefined) {
      coupon.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    return this.coupons.save(coupon);
  }

  async remove(id: string): Promise<void> {
    const res = await this.coupons.delete(id);
    if (!res.affected) throw new NotFoundException('Coupon not found');
  }
}
