import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AttributesModule } from '../attributes/attributes.module';
import { CategoriesModule } from '../categories/categories.module';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Products feature. Registers Product + ProductVariant repositories and imports
 * AuthModule (guards), plus Categories/Attributes to validate + resolve refs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant]),
    AuthModule,
    CategoriesModule,
    AttributesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
