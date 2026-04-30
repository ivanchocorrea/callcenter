import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ivr_menus')
@Index('uniq_ivr_slug', ['companyId', 'slug'], { unique: true })
export class IvrMenu {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ length: 80 })
  slug!: string;

  @Column({ length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'welcome_audio_id', type: 'bigint', nullable: true })
  welcomeAudioId!: number | null;

  @Column({ name: 'menu_audio_id', type: 'bigint', nullable: true })
  menuAudioId!: number | null;

  @Column({ name: 'invalid_audio_id', type: 'bigint', nullable: true })
  invalidAudioId!: number | null;

  @Column({ name: 'timeout_audio_id', type: 'bigint', nullable: true })
  timeoutAudioId!: number | null;

  @Column({ name: 'out_of_hours_audio_id', type: 'bigint', nullable: true })
  outOfHoursAudioId!: number | null;

  @Column({ name: 'business_hours_id', type: 'bigint', nullable: true })
  businessHoursId!: number | null;

  @Column({ name: 'timeout_seconds', type: 'int', default: 5 })
  timeoutSeconds!: number;

  @Column({ name: 'max_attempts', type: 'int', default: 3 })
  maxAttempts!: number;

  @Column({ name: 'on_invalid', type: 'enum', enum: ['repeat', 'goto', 'hangup', 'transfer'], default: 'repeat' })
  onInvalid!: 'repeat' | 'goto' | 'hangup' | 'transfer';

  @Column({ name: 'on_timeout', type: 'enum', enum: ['repeat', 'goto', 'hangup', 'transfer'], default: 'repeat' })
  onTimeout!: 'repeat' | 'goto' | 'hangup' | 'transfer';

  @Column({ name: 'fallback_destination_type', type: 'enum', enum: ['queue', 'agent', 'bot', 'voicemail', 'hangup', 'webhook'], nullable: true })
  fallbackDestinationType!: string | null;

  @Column({ name: 'fallback_destination_id', type: 'bigint', nullable: true })
  fallbackDestinationId!: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
