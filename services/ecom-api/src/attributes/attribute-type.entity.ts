import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A variant attribute TYPE, defined by admins (e.g. Color, Size, Strap). New
 * types can be added anytime — that's how "add more variants from the admin
 * panel" works.
 */
@Entity('attribute_types')
export class AttributeType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column()
  slug!: string;

  // 'swatch' hints the UI to render color chips; 'text' is a plain label.
  @Column({ type: 'varchar', default: 'text' })
  display!: 'text' | 'swatch';

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
