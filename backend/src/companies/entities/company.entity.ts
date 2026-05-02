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

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 200 })
  legalName!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 150 })
  displayName!: string;

  @Column({ name: 'tax_id', type: 'varchar', length: 60, nullable: true })
  taxId!: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 80, default: 'America/Bogota' })
  timezone!: string;

  @Column({ name: 'default_locale', type: 'varchar', length: 10, default: 'es-CO' })
  defaultLocale!: string;

  @Column({ name: 'primary_email', type: 'varchar', length: 180, nullable: true })
  primaryEmail!: string | null;

  @Column({ name: 'primary_phone', type: 'varchar', length: 40, nullable: true })
  primaryPhone!: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'suspended', 'trialing', 'closed'],
    default: 'trialing',
  })
  status!: CompanyStatus;

  @Column({ name: 'suspended_reason', type: 'varchar', length: 255, nullable: true })
  suspendedReason!: string | null;

  @Column({ name: 'plan_id', type: 'bigint', nullable: true })
  planId!: number | null;

  /** Si false, los agentes no pueden rechazar llamadas entrantes (botón oculto en UI). */
  @Column({ name: 'allow_agent_reject_inbound', type: 'boolean', default: true })
  allowAgentRejectInbound!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
