import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const DEFAULT_COUNTRY = 'US';

/**
 * Product routes.
 *   Public : browse the catalog priced for a `?country=` (default US).
 *   Admin  : product CRUD + per-country price management (JWT + role check).
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // ---- Public ---------------------------------------------------------------

  @Get()
  findAll(
    @Query('country') country?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.products.findAllForCountry(country || DEFAULT_COUNTRY, {
      search,
      category,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('country') country?: string) {
    return this.products.findOneForCountry(id, country || DEFAULT_COUNTRY);
  }

  // ---- Admin ----------------------------------------------------------------

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Get(':id/prices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listPrices(@Param('id') id: string) {
    return this.products.listPrices(id);
  }

  @Put(':id/prices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setPrice(@Param('id') id: string, @Body() dto: SetPriceDto) {
    return this.products.setPrice(id, dto);
  }

  @Delete(':id/prices/:country')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deletePrice(@Param('id') id: string, @Param('country') country: string) {
    return this.products.deletePrice(id, country);
  }
}
