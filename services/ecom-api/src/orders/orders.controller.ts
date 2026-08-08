import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { RefundDto } from './dto/refund.dto';
import { ReturnActionDto } from './dto/return-action.dto';
import { SetTrackingDto } from './dto/set-tracking.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';
import { ReturnsService } from './returns.service';

/** Uploaded file shape (multer memory storage). */
interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

const toInt = (v: string | undefined, d: number) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/** Order history + cancel/return (user) and management + refunds (admin). */
@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly returns: ReturnsService,
  ) {}

  // ---- User's own orders ----------------------------------------------------

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.listForUser(user.sub, toInt(page, 1), toInt(limit, 20));
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getForUser(user.sub, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancelForUser(user.sub, id, dto.reason);
  }

  // ---- Returns (user) -------------------------------------------------------

  @Post('orders/:id/returns')
  @UseGuards(JwtAuthGuard)
  requestReturn(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.create(user.sub, id, dto.reason, dto.items);
  }

  /** Attach evidence images to a return (owner). Max 5 images, 5 MB each. */
  @Post('returns/:returnId/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', 5, { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadReturnImages(
    @CurrentUser() user: AuthUser,
    @Param('returnId') returnId: string,
    @UploadedFiles() files: UploadedImage[],
  ) {
    return this.returns.addImages(user.sub, returnId, files ?? []);
  }

  /** Stream a return image (owner or admin). */
  @Get('returns/:returnId/images/:filename')
  @UseGuards(JwtAuthGuard)
  async returnImage(
    @CurrentUser() user: AuthUser,
    @Param('returnId') returnId: string,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const isAdmin = user.roles.includes('admin');
    const key = `returns/${returnId}/${filename}`;
    const { stream, contentType } = await this.returns.getImage(
      returnId,
      key,
      isAdmin ? null : user.sub,
    );
    return new StreamableFile(stream, { type: contentType });
  }

  @Get('returns')
  @UseGuards(JwtAuthGuard)
  myReturns(@CurrentUser() user: AuthUser) {
    return this.returns.listForUser(user.sub);
  }

  // ---- Admin ----------------------------------------------------------------

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.orders.listAll(toInt(page, 1), toInt(limit, 50));
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Post('admin/orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminCancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancelAsAdmin(id, dto.reason);
  }

  @Post('admin/orders/:id/refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  refund(@Param('id') id: string, @Body() dto: RefundDto) {
    return this.orders.refund(id, dto.amountMinor);
  }

  @Patch('admin/orders/:id/tracking')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setTracking(@Param('id') id: string, @Body() dto: SetTrackingDto) {
    return this.orders.setTracking(id, dto.carrier, dto.trackingNumber);
  }

  @Get('admin/returns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listReturns() {
    return this.returns.listAll();
  }

  @Patch('admin/returns/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  actOnReturn(@Param('id') id: string, @Body() dto: ReturnActionDto) {
    return this.returns.transition(id, dto.action);
  }
}
