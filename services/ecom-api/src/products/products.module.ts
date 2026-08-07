import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ProductPrice } from './product-price.entity';
import { Product } from './product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Products feature. Registers the Product + ProductPrice repositories and
 * imports AuthModule for the JWT/roles guards on the admin routes.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductPrice]), AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
