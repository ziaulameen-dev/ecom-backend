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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * Categories.
 *   Public : browse the tree (or flat list) for menus/filters.
 *   Admin  : CRUD (JWT + role check).
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // ---- Public ---------------------------------------------------------------

  /** `?tree=1` returns nested top→sub; otherwise a flat list. */
  @Get()
  findAll(@Query('tree') tree?: string) {
    return tree ? this.categories.tree() : this.categories.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }

  // ---- Admin ----------------------------------------------------------------

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
