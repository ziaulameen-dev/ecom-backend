import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * A concrete value for an attribute type (e.g. type Color → Black, Blue; type
 * Size → 40mm, 42mm). `swatch` is optional presentation data for color chips
 * (a hex stored as DATA — component styling still uses Tailwind tokens).
 */
@Entity('attribute_values')
@Unique(['typeId', 'value'])
export class AttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'type_id', type: 'uuid' })
  typeId!: string;

  @Column()
  value!: string;

  // e.g. "#0f172a" for a Color swatch. Presentation data only; nullable.
  @Column({ type: 'varchar', nullable: true })
  swatch!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
