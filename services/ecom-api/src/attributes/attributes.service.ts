import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttributeType } from './attribute-type.entity';
import { AttributeValue } from './attribute-value.entity';
import {
  CreateAttributeTypeDto,
  CreateAttributeValueDto,
  UpdateAttributeTypeDto,
} from './dto/attribute.dto';

/** An attribute type with its values (for admin UIs + PDP option pickers). */
export interface AttributeTypeWithValues extends AttributeType {
  values: AttributeValue[];
}

/** Admin-defined variant attributes (types + values). */
@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(AttributeType)
    private readonly types: Repository<AttributeType>,
    @InjectRepository(AttributeValue)
    private readonly values: Repository<AttributeValue>,
  ) {}

  /** All types, each with its values (sorted). */
  async listWithValues(): Promise<AttributeTypeWithValues[]> {
    const [types, values] = await Promise.all([
      this.types.find({ order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.values.find({ order: { sortOrder: 'ASC', value: 'ASC' } }),
    ]);
    return types.map((t) => ({
      ...t,
      values: values.filter((v) => v.typeId === t.id),
    }));
  }

  /** Resolve a set of value ids into full rows (used when building variants). */
  async valuesByIds(ids: string[]): Promise<AttributeValue[]> {
    if (!ids.length) return [];
    return this.values.find({ where: { id: In(ids) } });
  }

  // ---- Types ----------------------------------------------------------------

  async createType(dto: CreateAttributeTypeDto): Promise<AttributeType> {
    if (await this.types.findOne({ where: { slug: dto.slug } })) {
      throw new BadRequestException(`Attribute slug "${dto.slug}" already exists`);
    }
    return this.types.save(this.types.create(dto));
  }

  async updateType(id: string, dto: UpdateAttributeTypeDto): Promise<AttributeType> {
    const type = await this.types.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Attribute type not found');
    Object.assign(type, dto);
    return this.types.save(type);
  }

  async removeType(id: string): Promise<void> {
    await this.values.delete({ typeId: id }); // drop its values too
    const res = await this.types.delete(id);
    if (!res.affected) throw new NotFoundException('Attribute type not found');
  }

  // ---- Values ---------------------------------------------------------------

  async addValue(typeId: string, dto: CreateAttributeValueDto): Promise<AttributeValue> {
    if (!(await this.types.findOne({ where: { id: typeId } }))) {
      throw new NotFoundException('Attribute type not found');
    }
    return this.values.save(this.values.create({ ...dto, typeId }));
  }

  async removeValue(id: string): Promise<void> {
    const res = await this.values.delete(id);
    if (!res.affected) throw new NotFoundException('Attribute value not found');
  }
}
