import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'prospect';

@Entity('customers')
@Index('idx_cust_company_phone', ['companyId', 'primaryPhone'])
@Index('idx_cust_company_doc', ['companyId', 'documentNumber'])
@Index('idx_cust_company_email', ['companyId', 'email'])
export class Customer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ name: 'external_id', type: 'varchar', length: 120, nullable: true })
  externalId!: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 200 })
  fullName!: string;

  @Column({ name: 'document_type', type: 'varchar', length: 20, nullable: true })
  documentType!: string | null;

  @Column({ name: 'document_number', type: 'varchar', length: 60, nullable: true })
  documentNumber!: string | null;

  @Column({ name: 'primary_phone', type: 'varchar', length: 40, nullable: true })
  primaryPhone!: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email!: string | null;

  @Column({ name: 'company_name', type: 'varchar', length: 180, nullable: true })
  companyName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  timezone!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  locale!: string | null;

  @Column({ type: 'enum', enum: ['active', 'inactive', 'blocked', 'prospect'], default: 'active' })
  status!: CustomerStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source!: string | null;

  @Column({ name: 'is_vip', default: false })
  isVip!: boolean;

  @Column({ name: 'important_notes', type: 'text', nullable: true })
  importantNotes!: string | null;

  @Column({ name: 'custom_fields', type: 'json', nullable: true })
  customFields!: Record<string, unknown> | null;

  @Column({ name: 'last_interaction_at', type: 'timestamp', nullable: true })
  lastInteractionAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
