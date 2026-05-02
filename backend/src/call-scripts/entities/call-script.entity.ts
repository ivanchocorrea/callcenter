import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('call_scripts')
@Index('idx_call_scripts_company', ['companyId', 'isActive', 'sortOrder'])
export class CallScript {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  /** Markdown o HTML — el frontend lo renderiza. */
  @Column({ type: 'text' })
  content!: string;

  /** outbound = solo en llamadas salientes; inbound = solo en entrantes; both = ambos. */
  @Column({ name: 'script_type', type: 'enum', enum: ['outbound', 'inbound', 'both'], default: 'both' })
  scriptType!: 'outbound' | 'inbound' | 'both';

  @Column({ name: 'sort_order', type: 'int', default: 100 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
