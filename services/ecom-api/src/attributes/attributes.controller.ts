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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AttributesService } from './attributes.service';
import {
  CreateAttributeTypeDto,
  CreateAttributeValueDto,
  UpdateAttributeTypeDto,
} from './dto/attribute.dto';

/**
 * Variant attributes (Color/Size/Strap…).
 *   Public : list types + values (for PDP option pickers & PLP filters).
 *   Admin  : manage types and their values.
 */
@Controller()
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get('attributes')
  list() {
    return this.attributes.listWithValues();
  }

  @Post('attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createType(@Body() dto: CreateAttributeTypeDto) {
    return this.attributes.createType(dto);
  }

  @Patch('attributes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateType(@Param('id') id: string, @Body() dto: UpdateAttributeTypeDto) {
    return this.attributes.updateType(id, dto);
  }

  @Delete('attributes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeType(@Param('id') id: string) {
    return this.attributes.removeType(id);
  }

  @Post('attributes/:id/values')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addValue(@Param('id') id: string, @Body() dto: CreateAttributeValueDto) {
    return this.attributes.addValue(id, dto);
  }

  @Delete('attribute-values/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeValue(@Param('id') id: string) {
    return this.attributes.removeValue(id);
  }
}
