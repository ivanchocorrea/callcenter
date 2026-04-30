import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agents')
@Index('uniq_agent_company_ext', ['companyId', 'extension'], { unique: true })
@Index('uniq_agent_user', ['userId'], { unique: true })
export class Agent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  @Column({ length: 20 })
  extension!: string;

  @Column({ name: 'sip_secret_encrypted', type: 'text' })
  sipSecretEncrypted!: string;

  @Column({ name: 'display_name', length: 150 })
  displayName!: string;

  @Column({ length: 120, nullable: true })
  department!: string | null;

  @Column({ name: 'skill_level', type: 'tinyint', default: 1 })
  skillLevel!: number;

  @Column({ name: 'max_concurrent_calls', type: 'tinyint', default: 1 })
  maxConcurrentCalls!: number;

  @Column({ name: 'can_be_recorded', default: true })
  canBeRecorded!: boolean;

  @Column({ name: 'auto_answer', default: false })
  autoAnswer!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
