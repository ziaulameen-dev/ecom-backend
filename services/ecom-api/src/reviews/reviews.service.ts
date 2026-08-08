import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './review.entity';

/** Reviews for a product: the list plus an aggregate (average + count). */
export interface ReviewSummary {
  average: number; // 0..5, one decimal
  count: number;
  items: Review[];
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
  ) {}

  /** Public: reviews for a product + aggregate rating. */
  async forProduct(productId: string): Promise<ReviewSummary> {
    const items = await this.reviews.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
    const count = items.length;
    const average = count
      ? Math.round((items.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;
    return { average, count, items };
  }

  listAll(): Promise<Review[]> {
    return this.reviews.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: CreateReviewDto): Promise<Review> {
    return this.reviews.save(this.reviews.create(dto));
  }

  async remove(id: string): Promise<void> {
    const res = await this.reviews.delete(id);
    if (!res.affected) throw new NotFoundException('Review not found');
  }
}
