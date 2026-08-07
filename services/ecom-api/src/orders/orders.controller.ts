import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

/** Order history (user) + order management (admin). */
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // ---- User's own orders ----------------------------------------------------

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.orders.listForUser(user.sub);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getForUser(user.sub, id);
  }

  // ---- Admin ----------------------------------------------------------------

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAll() {
    return this.orders.listAll();
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }
}
