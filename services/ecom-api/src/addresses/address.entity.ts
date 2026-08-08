import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A user's saved shipping address. India-only store, so `country` is always
 * 'IN'. One address per user may be marked default.
 */
@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column()
  line1!: string;

  @Column({ type: 'varchar', nullable: true })
  line2!: string | null;

  @Column()
  city!: string;

  @Column({ type: 'varchar', nullable: true })
  state!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', nullable: true })
  postalCode!: string | null;

  // ISO 3166-1 alpha-2 — always 'IN' (India-only store).
  @Column({ type: 'varchar', length: 2, default: 'IN' })
  country!: string;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
