import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';
import { CashfreeService } from '../cashfree/cashfree.service';
import { ReturnRequest } from './return-request.entity';
import { ReturnsService } from './returns.service';

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((x) => x),
    save: jest.fn().mockImplementation((x) => Promise.resolve({ id: 'r1', ...x })),
  } as unknown as jest.Mocked<Repository<ReturnRequest>>;
}

const ORDER = {
  id: 'o1',
  status: 'delivered',
  paymentRef: 'cf_1',
  totalMinor: 200,
  refundedMinor: 0,
  items: [
    { productId: 'p1', name: 'Tee', unitAmountMinor: 100, quantity: 2, returnedQuantity: 0 },
  ],
};

describe('ReturnsService', () => {
  let repo: jest.Mocked<Repository<ReturnRequest>>;
  let orders: { loadOwned: jest.Mock; saveEntity: jest.Mock };
  let cashfree: { refund: jest.Mock };
  let products: { incrementStock: jest.Mock };
  let service: ReturnsService;

  beforeEach(() => {
    repo = makeRepo();
    orders = {
      loadOwned: jest.fn().mockResolvedValue({ ...ORDER, items: [...ORDER.items.map((i) => ({ ...i }))] }),
      saveEntity: jest.fn().mockResolvedValue(undefined),
    };
    cashfree = { refund: jest.fn().mockResolvedValue(undefined) };
    products = { incrementStock: jest.fn().mockResolvedValue(undefined) };
    service = new ReturnsService(
      repo,
      orders as unknown as OrdersService,
      cashfree as unknown as CashfreeService,
      products as unknown as ProductsService,
    );
  });

  describe('create (over-return guard)', () => {
    it('rejects returning more than ordered', async () => {
      await expect(
        service.create('u1', 'o1', 'too many', [{ productId: 'p1', quantity: 3 }]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when a prior non-rejected return already claimed the units', async () => {
      repo.find.mockResolvedValue([
        { status: 'approved', items: [{ productId: 'p1', quantity: 2 }] } as ReturnRequest,
      ]);
      await expect(
        service.create('u1', 'o1', 'again', [{ productId: 'p1', quantity: 1 }]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a valid quantity', async () => {
      const rr = await service.create('u1', 'o1', 'defective', [
        { productId: 'p1', quantity: 2 },
      ]);
      expect(rr.status).toBe('requested');
    });

    it('rejects returns on non-shipped orders', async () => {
      orders.loadOwned.mockResolvedValue({ ...ORDER, status: 'paid' });
      await expect(
        service.create('u1', 'o1', 'x', [{ productId: 'p1', quantity: 1 }]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('transition guards', () => {
    it('cannot receive a requested return (must approve first)', async () => {
      repo.findOne.mockResolvedValue({ id: 'r1', status: 'requested' } as ReturnRequest);
      await expect(service.transition('r1', 'receive')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refund step issues partial refund + restock + marks refunded', async () => {
      repo.findOne.mockResolvedValue({
        id: 'r1',
        orderId: 'o1',
        status: 'received',
        items: [{ productId: 'p1', quantity: 1 }],
        refundMinor: 0,
      } as ReturnRequest);
      const rr = await service.transition('r1', 'refund');
      expect(cashfree.refund).toHaveBeenCalledWith(
        expect.objectContaining({ cfOrderId: 'cf_1', amountMinor: 100 }),
      ); // 1 x 100
      expect(products.incrementStock).toHaveBeenCalledWith('p1', 1);
      expect(rr.status).toBe('refunded');
      expect(rr.refundMinor).toBe(100);
    });
  });
});
