import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthUser } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { Cart } from './cart.entity';
import { CartService, CartView } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { SetCountryDto } from './dto/set-country.dto';
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
    @Query('country') country?: string,
  ) {
    return this.withCart(req, res, country, (c) => this.cart.view(c));
  }

  @Patch()
  async setCountry(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: SetCountryDto,
  ) {
    return this.withCart(req, res, dto.country, (c) => this.cart.view(c));
  }

  @Post('items')
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddItemDto,
  ) {
    return this.withCart(req, res, dto.country, async (c) => {
      await this.cart.addItem(c, dto.productId, dto.quantity);
      return this.cart.view(c);
    });
  }

  @Patch('items/:productId')
  async updateItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('productId') productId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.withCart(req, res, undefined, async (c) => {
      await this.cart.setItemQuantity(c, productId, dto.quantity);
      return this.cart.view(c);
    });
  }

  @Delete('items/:productId')
  async removeItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('productId') productId: string,
  ) {
    return this.withCart(req, res, undefined, async (c) => {
      await this.cart.removeItem(c, productId);
      return this.cart.view(c);
    });
  }

  @Delete()
  async clear(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withCart(req, res, undefined, async (c) => {
      await this.cart.clear(c);
      return this.cart.view(c);
    });
  }

  /**
   * Resolve the caller's cart (user or guest), optionally switch its country,
   * (re)set the guest cookie, run the operation, and return the cart view.
   */
  private async withCart(
    req: Request,
    res: Response,
    country: string | undefined,
    op: (cart: Cart) => Promise<CartView>,
  ): Promise<CartView> {
    const user = (req as Request & { user?: AuthUser }).user;
    const cookieName = this.config.get<string>('cart.cookieName')!;
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;

    let { cart } = await this.cart.resolveOrCreate(
      { userId: user?.sub ?? null, cookieCartId: cookies?.[cookieName] ?? null },
      country,
    );
    if (country && cart.country !== country.toUpperCase()) {
      cart = await this.cart.setCountry(cart, country);
    }

    // Keep guest carts addressable via the cookie.
    if (!cart.userId) {
      res.cookie(cookieName, cart.id, {
        httpOnly: true,
        sameSite: this.config.get('cart.sameSite'),
        secure: this.config.get<boolean>('cart.secure'),
        path: '/',
        maxAge: this.config.get<number>('cart.maxAgeMs'),
      });
    }
    return op(cart);
  }
}
