import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './product.entity';

/**
 * Product business logic, backed by the ecom-api's OWN Postgres (via TypeORM).
 */
@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /** Seed a couple of demo products on first boot so the list isn't empty. */
  async onModuleInit() {
    if ((await this.products.count()) === 0) {
      await this.products.save([
        this.products.create({ name: 'T-Shirt', priceCents: 1999, stock: 100 }),
        this.products.create({ name: 'Sneakers', priceCents: 8999, stock: 25 }),
      ]);
      this.logger.log('Seeded demo products');
    }
  }

  findAll(): Promise<Product[]> {
    return this.products.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: CreateProductDto): Promise<Product> {
    return this.products.save(this.products.create(dto));
  }
}
