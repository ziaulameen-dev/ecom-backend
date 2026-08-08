import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Review } from './review.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/** Product reviews (admin-curated for now). */
@Module({
  imports: [TypeOrmModule.forFeature([Review]), AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
