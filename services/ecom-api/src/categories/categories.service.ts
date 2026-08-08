import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './category.entity';

/** A top category with its subcategories nested (for storefront menus). */
export interface CategoryNode extends Category {
  children: Category[];
}

/** Categories + subcategories (one level deep). */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  /** Flat list, ordered for admin tables. */
  findAll(): Promise<Category[]> {
    return this.categories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  /** Nested tree: top categories (parentId null) each with their children. */
  async tree(): Promise<CategoryNode[]> {
    const all = await this.findAll();
    const tops = all.filter((c) => !c.parentId);
    return tops.map((top) => ({
      ...top,
      children: all.filter((c) => c.parentId === top.id),
    }));
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { slug } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertSlugFree(dto.slug);
    if (dto.parentId) await this.assertTopLevel(dto.parentId);
    return this.categories.save(this.categories.create({ ...dto, parentId: dto.parentId ?? null }));
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.mustFind(id);
    if (dto.slug && dto.slug !== category.slug) await this.assertSlugFree(dto.slug);
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
      await this.assertTopLevel(dto.parentId);
    }
    Object.assign(category, dto);
    return this.categories.save(category);
  }

  async remove(id: string): Promise<void> {
    const childCount = await this.categories.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Remove or reassign subcategories first');
    }
    const res = await this.categories.delete(id);
    if (!res.affected) throw new NotFoundException('Category not found');
  }

  /** True if the id is a real category (used by products to validate). */
  async exists(id: string): Promise<boolean> {
    return (await this.categories.count({ where: { id } })) > 0;
  }

  private async mustFind(id: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async assertSlugFree(slug: string): Promise<void> {
    if (await this.categories.findOne({ where: { slug } })) {
      throw new BadRequestException(`Slug "${slug}" is already taken`);
    }
  }

  /** Parent must exist and itself be top-level (we only allow one nesting level). */
  private async assertTopLevel(parentId: string): Promise<void> {
    const parent = await this.categories.findOne({ where: { id: parentId } });
    if (!parent) throw new BadRequestException('Parent category not found');
    if (parent.parentId) {
      throw new BadRequestException('Only one level of subcategories is supported');
    }
  }
}
