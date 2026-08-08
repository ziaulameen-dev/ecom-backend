import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

/**
 * Reviews.
 *   Public : list a product's reviews + average rating.
 *   Admin  : create / delete (curated for now) + list all.
 */
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:productId/reviews')
  forProduct(@Param('productId') productId: string) {
    return this.reviews.forProduct(productId);
  }

  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAll() {
    return this.reviews.listAll();
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateReviewDto) {
    return this.reviews.create(dto);
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
