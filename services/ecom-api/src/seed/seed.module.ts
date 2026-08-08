import { Module } from '@nestjs/common';
import { AttributesModule } from '../attributes/attributes.module';
import { CategoriesModule } from '../categories/categories.module';
import { CouponsModule } from '../coupons/coupons.module';
import { ProductsModule } from '../products/products.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SeedService } from './seed.service';

/** First-boot demo catalog seeding (guarded by product count). */
@Module({
  imports: [
    CategoriesModule,
    AttributesModule,
    ProductsModule,
    ReviewsModule,
    CouponsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
