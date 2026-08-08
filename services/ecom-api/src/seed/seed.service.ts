import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AttributesService } from '../attributes/attributes.service';
import { CategoriesService } from '../categories/categories.service';
import { CouponsService } from '../coupons/coupons.service';
import { ProductsService } from '../products/products.service';
import { ReviewsService } from '../reviews/reviews.service';

/**
 * Seeds a coherent demo catalog on first boot (only when there are no products):
 * categories + subcategories, variant attributes, a couple of products (one with
 * variants), reviews, and coupons. Idempotent via the product-count guard.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly categories: CategoriesService,
    private readonly attributes: AttributesService,
    private readonly products: ProductsService,
    private readonly reviews: ReviewsService,
    private readonly coupons: CouponsService,
  ) {}

  async onModuleInit() {
    if ((await this.products.count()) > 0) return;
    this.logger.log('Seeding demo catalog…');

    // --- Categories: Watch/Perfume → Men/Women/Unisex ------------------------
    const watch = await this.categories.create({ name: 'Watches', slug: 'watches', sortOrder: 1 });
    const perfume = await this.categories.create({ name: 'Perfumes', slug: 'perfumes', sortOrder: 2 });
    const [watchMen] = await Promise.all([
      this.categories.create({ name: 'Men', slug: 'watches-men', parentId: watch.id }),
      this.categories.create({ name: 'Women', slug: 'watches-women', parentId: watch.id }),
      this.categories.create({ name: 'Unisex', slug: 'watches-unisex', parentId: watch.id }),
    ]);
    const perfumeUnisex = await this.categories.create({
      name: 'Unisex', slug: 'perfumes-unisex', parentId: perfume.id,
    });
    await this.categories.create({ name: 'Men', slug: 'perfumes-men', parentId: perfume.id });
    await this.categories.create({ name: 'Women', slug: 'perfumes-women', parentId: perfume.id });

    // --- Attributes: Color (swatch), Strap, Size -----------------------------
    const color = await this.attributes.createType({ name: 'Color', slug: 'color', display: 'swatch' });
    const black = await this.attributes.addValue(color.id, { value: 'Black', swatch: '#111827' });
    const silver = await this.attributes.addValue(color.id, { value: 'Silver', swatch: '#cbd5e1' });

    const strap = await this.attributes.createType({ name: 'Strap', slug: 'strap' });
    const steel = await this.attributes.addValue(strap.id, { value: 'Steel' });
    const leather = await this.attributes.addValue(strap.id, { value: 'Leather' });

    const size = await this.attributes.createType({ name: 'Size', slug: 'size' });
    const ml50 = await this.attributes.addValue(size.id, { value: '50ml' });
    const ml100 = await this.attributes.addValue(size.id, { value: '100ml' });

    // --- Product 1: watch WITH variants (Color × Strap) ----------------------
    const chrono = await this.products.create({
      name: 'Chrono Steel Watch',
      slug: 'chrono-steel-watch',
      priceMinor: 1299900,
      stock: 0, // stock lives on the variants
      categoryId: watchMen.id,
      category: 'watch',
      description: 'Automatic chronograph with sapphire crystal.',
      imageUrl: 'https://placehold.co/600x600?text=Chrono+Watch',
    });
    await this.products.addVariant(chrono.id, {
      valueIds: [black.id, steel.id], priceMinor: 1299900, stock: 12,
      sku: 'CHR-BLK-STL', isDefault: true,
      images: ['https://placehold.co/600x600?text=Black+Steel'],
    });
    await this.products.addVariant(chrono.id, {
      valueIds: [silver.id, steel.id], priceMinor: 1349900, stock: 8,
      sku: 'CHR-SLV-STL',
      images: ['https://placehold.co/600x600?text=Silver+Steel'],
    });
    await this.products.addVariant(chrono.id, {
      valueIds: [black.id, leather.id], priceMinor: 1199900, stock: 5,
      sku: 'CHR-BLK-LTR', listedSeparately: true, // shows as its own PLP card
      images: ['https://placehold.co/600x600?text=Black+Leather'],
    });

    // --- Product 2: perfume with Size variants -------------------------------
    const aqua = await this.products.create({
      name: 'Aqua Eau de Parfum',
      slug: 'aqua-eau-de-parfum',
      priceMinor: 499900,
      stock: 0,
      categoryId: perfumeUnisex.id,
      category: 'perfume',
      description: 'Fresh aquatic unisex fragrance.',
      imageUrl: 'https://placehold.co/600x600?text=Aqua+Perfume',
    });
    await this.products.addVariant(aqua.id, {
      valueIds: [ml50.id], priceMinor: 349900, stock: 40, sku: 'AQ-50', isDefault: true,
    });
    await this.products.addVariant(aqua.id, {
      valueIds: [ml100.id], priceMinor: 499900, stock: 25, sku: 'AQ-100',
    });

    // --- Product 3: simple (no variants) -------------------------------------
    const strapKit = await this.products.create({
      name: 'Leather Strap Kit',
      slug: 'leather-strap-kit',
      priceMinor: 149900,
      stock: 100,
      categoryId: watchMen.id,
      category: 'accessory',
      description: 'Quick-release leather strap with tool.',
      imageUrl: 'https://placehold.co/600x600?text=Strap+Kit',
    });

    // --- Reviews (curated) ---------------------------------------------------
    await this.reviews.create({
      productId: chrono.id, rating: 5, title: 'Stunning',
      body: 'Feels premium and keeps perfect time.', authorName: 'Arjun',
    });
    await this.reviews.create({
      productId: chrono.id, rating: 4, title: 'Great value',
      body: 'Heavier than expected, in a good way.', authorName: 'Meera',
    });
    await this.reviews.create({
      productId: aqua.id, rating: 5, body: 'Lasts all day.', authorName: 'Kabir',
    });

    // --- Coupons -------------------------------------------------------------
    await this.coupons.create({ code: 'WELCOME10', type: 'percent', value: 10, maxDiscountMinor: 200000 });
    await this.coupons.create({ code: 'FLAT500', type: 'fixed', value: 50000, minSubtotalMinor: 500000 });

    void strapKit;
    this.logger.log('Demo catalog seeded');
  }
}
