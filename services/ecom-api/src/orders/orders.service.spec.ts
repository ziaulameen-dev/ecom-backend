import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AddressesService } from '../addresses/addresses.service';
import { CartService } from '../cart/cart.service';
import { CashfreeService } from '../cashfree/cashfree.service';
import { EventsService } from '../events/events.service';
import { MailService } from '../mail/mail.service';
import { ProductsService } from '../products/products.service';
import { ShippingService } from '../shipping/shipping.service';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as jest.Mocked<Repository<Order>>;
}

describe('OrdersService', () => {
  let repo: jest.Mocked<Repository<Order>>;
  let products: { decrementStock: jest.Mock; incrementStock: jest.Mock };
  let cashfree: { refund: jest.Mock };
  let carts: { resolveOrCreate: jest.Mock; clear: jest.Mock };
  let mail: { sendOrderUpdate: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    repo = makeRepo();
    products = {
      decrementStock: jest.fn(),
      incrementStock: jest.fn().mockResolvedValue(undefined),
    };
    cashfree = { refund: jest.fn().mockResolvedValue(undefined) };
    carts = {
      resolveOrCreate: jest.fn().mockResolvedValue({ cart: { id: 'c1' } }),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    mail = { sendOrderUpdate: jest.fn().mockResolvedValue(undefined) };
    service = new OrdersService(
      repo,
      carts as unknown as CartService,
      {} as AddressesService,
      {} as ShippingService,
      products as unknown as ProductsService,
      cashfree as unknown as CashfreeService,
      mail as unknown as MailService,
      { get: jest.fn() } as unknown as ConfigService,
      { emit: jest.fn() } as unknown as EventsService,
    );
  });

  const pendingOrder = () =>
    ({
      id: 'o1',
      status: 'pending',
      paymentRef: 'cf_1',
      totalMinor: 300,
      refundedMinor: 0,
      userId: 'u1',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 2 },
      ],
    }) as Order;

  describe('markPaidByRef', () => {
    it('marks paid + clears cart when all stock decrements succeed', async () => {
      repo.findOne.mockResolvedValue(pendingOrder());
      products.decrementStock.mockResolvedValue(true);
      await service.markPaidByRef('cf_1');
      expect(carts.clear).toHaveBeenCalled();
      expect(cashfree.refund).not.toHaveBeenCalled();
      const saved = repo.save.mock.calls.at(-1)![0] as Order;
      expect(saved.status).toBe('paid');
    });

    it('auto-refunds + cancels + rolls back stock on oversell', async () => {
      repo.findOne.mockResolvedValue(pendingOrder());
      // first line ok, second line out of stock
      products.decrementStock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await service.markPaidByRef('cf_1');
      expect(cashfree.refund).toHaveBeenCalledWith(
        expect.objectContaining({ cfOrderId: 'cf_1', amountMinor: 300 }),
      );
      expect(products.incrementStock).toHaveBeenCalledWith('p1', 1); // rollback
      expect(carts.clear).not.toHaveBeenCalled();
      const saved = repo.save.mock.calls.at(-1)![0] as Order;
      expect(saved.status).toBe('cancelled');
      expect(saved.refundedMinor).toBe(300);
    });

    it('is idempotent (ignores already-paid orders)', async () => {
      repo.findOne.mockResolvedValue({ ...pendingOrder(), status: 'paid' } as Order);
      await service.markPaidByRef('cf_1');
      expect(products.decrementStock).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus (guard)', () => {
    it('allows a fulfillment transition (paid -> shipped)', async () => {
      repo.findOne.mockResolvedValue({ ...pendingOrder(), status: 'paid' } as Order);
      const out = await service.updateStatus('o1', 'shipped');
      expect(out.status).toBe('shipped');
    });

    it('blocks faking a money-state (paid -> refunded)', async () => {
      repo.findOne.mockResolvedValue({ ...pendingOrder(), status: 'paid' } as Order);
      await expect(service.updateStatus('o1', 'refunded')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
