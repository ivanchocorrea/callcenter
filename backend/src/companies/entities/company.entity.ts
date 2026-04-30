import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CompanyStatus = 'active' | 'suspended' | 'trialing' | 'closed';

@Entity('companies')
@Index('idx_companies_status', ['status'])
export class Company {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ length: 120, unique: true })
  slug!: string;

  @Column({ name: 'legal_name', length: 200 })
  legalName!: string;

  @Column({ name: 'display_name', length: 150 })
  displayName!: string;

  @Column({ name: 'tax_id', length: 60, nullable: true })
  taxId!: string | null;

  @Column({ length: 2, nullable: true })
  country!: string | null;

  @Column({ length: 80, default: 'America/Bogota' })
  timezone!: string;

  @Column({ name: 'default_locale', length: 10, default: 'es-CO' })
  defaultLocale!: string;

  @Column({ name: 'primary_email', length: 180, nullable: true })
  primaryEmail!: string | null;

  @Column({ name: 'primary_phone', length: 40, nullable: true })
  primaryPhone!: string | null;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'suspended', 'trialing', 'closed'],
    default: 'trialing',
  })
  status!: CompanyStatus;

  @Column({ name: 'suspended_reason', length: 255, nullable: true })
  suspendedReason!: string | null;

  @Column({ name: 'plan_id', type: 'bigint', nullable: true })
  planId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
