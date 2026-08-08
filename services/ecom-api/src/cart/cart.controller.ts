import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { Cart } from './cart.entity';
import { CartService, CartView } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

/**
 * Cart routes. Works for guests (identified by the `cart_id` cookie) and for
 * logged-in users (their cart follows the account). OptionalAuthGuard attaches
 * `req.user` when a valid token is present but never rejects.
 */
@Controller('cart')
@UseGuards(OptionalAuthGuard)
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async get(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withCart(req, res, (c) => this.cart.view(c));
  }

  @Post('items')
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddItemDto,
  ) {
    return this.withCart(req, res, async (c) => {
      await this.cart.addItem(c, dto.productId, dto.variantId ?? null, dto.quantity);
      return this.cart.view(c);
    });
  }

  @Patch('items/:itemId')
  async updateItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.withCart(req, res, async (c) => {
      await this.cart.setItemQuantity(c, itemId, dto.quantity);
      return this.cart.view(c);
    });
  }

  @Delete('items/:itemId')
  async removeItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('itemId') itemId: string,
  ) {
    return this.withCart(req, res, async (c) => {
      await this.cart.removeItem(c, itemId);
      return this.cart.view(c);
    });
  }

  @Delete()
  async clear(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withCart(req, res, async (c) => {
      await this.cart.clear(c);
      return this.cart.view(c);
    });
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  // Call right after login: fold the guest cart (cookie) into the user's cart.
  async merge(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const merged = await this.cart.merge(user.sub, this.readCartId(req));
    // The user's cart is found by token now; drop the stale guest cookie.
    res.clearCookie(this.config.get<string>('cart.cookieName')!, { path: '/' });
    return this.cart.view(merged);
  }

  /**
   * Resolve the caller's cart (user or guest), (re)set the guest cookie, run the
   * operation, and return the cart view.
   */
  private async withCart(
    req: Request,
    res: Response,
    op: (cart: Cart) => Promise<CartView>,
  ): Promise<CartView> {
    const user = (req as Request & { user?: AuthUser }).user;
    const cartId = this.readCartId(req);

    const { cart } = await this.cart.resolveOrCreate({
      userId: user?.sub ?? null,
      cookieCartId: cartId,
    });

    // Keep guest carts addressable: set the cookie (same-origin browsers) — the
    // cart id is also in the response body so header-based clients (mobile /
    // cross-origin) can echo it back via X-Cart-Id.
    if (!cart.userId) {
      res.cookie(this.config.get<string>('cart.cookieName')!, cart.id, {
        httpOnly: true,
        sameSite: this.config.get('cart.sameSite'),
        secure: this.config.get<boolean>('cart.secure'),
        path: '/',
        maxAge: this.config.get<number>('cart.maxAgeMs'),
      });
    }
    return op(cart);
  }

  /** Guest cart id from the X-Cart-Id header (cross-origin) or the cookie. */
  private readCartId(req: Request): string | null {
    const header = req.headers['x-cart-id'];
    if (typeof header === 'string' && header) return header;
    const cookieName = this.config.get<string>('cart.cookieName')!;
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    return cookies?.[cookieName] ?? null;
  }
}
