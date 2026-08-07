import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

/**
 * Product routes. Demonstrates BOTH access levels:
 *   - GET  /api/products  -> PUBLIC (anyone can browse the catalog)
 *   - POST /api/products  -> PROTECTED, admins only (JWT + role check)
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll() {
    return this.products.findAll();
  }

  @Post()
  // JwtAuthGuard verifies the token via JWKS; RolesGuard enforces @Roles.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }
}
