import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('queues')
@Index('uniq_queue_slug', ['companyId', 'slug'], { unique: true })
export class Queue {
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

  @Column({ type: 'enum', enum: ['ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory', 'linear', 'wrandom', 'skills'], default: 'rrmemory' })
  strategy!: string;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'max_wait_seconds', type: 'int', nullable: true })
  maxWaitSeconds!: number | null;

  @Column({ name: 'ring_seconds', type: 'int', default: 20 })
  ringSeconds!: number;

  @Column({ name: 'wrap_up_seconds', type: 'int', default: 10 })
  wrapUpSeconds!: number;

  @Column({ name: 'retry_seconds', type: 'int', default: 5 })
  retrySeconds!: number;

  @Column({ name: 'join_empty', default: false })
  joinEmpty!: boolean;

  @Column({ name: 'leave_when_empty', default: true })
  leaveWhenEmpty!: boolean;

  @Column({ type: 'enum', enum: ['off', 'on', 'all'], default: 'off' })
  autopause!: string;

  @Column({ name: 'moh_id', type: 'bigint', nullable: true })
  mohId!: number | null;

  @Column({ name: 'welcome_audio_id', type: 'bigint', nullable: true })
  welcomeAudioId!: number | null;

  @Column({ name: 'position_announce_enabled', default: true })
  positionAnnounceEnabled!: boolean;

  @Column({ name: 'position_announce_interval', type: 'int', default: 30 })
  positionAnnounceInterval!: number;

  @Column({ name: 'estimated_wait_announce_enabled', default: true })
  estimatedWaitAnnounceEnabled!: boolean;

  @Column({ name: 'callback_offer_enabled', default: false })
  callbackOfferEnabled!: boolean;

  @Column({ name: 'callback_offer_after_seconds', type: 'int', nullable: true })
  callbackOfferAfterSeconds!: number | null;

  @Column({ name: 'sms_on_abandon_enabled', default: false })
  smsOnAbandonEnabled!: boolean;

  @Column({ name: 'sms_on_abandon_template_id', type: 'bigint', nullable: true })
  smsOnAbandonTemplateId!: number | null;

  @Column({ name: 'business_hours_id', type: 'bigint', nullable: true })
  businessHoursId!: number | null;

  @Column({ name: 'out_of_hours_audio_id', type: 'bigint', nullable: true })
  outOfHoursAudioId!: number | null;

  @Column({ name: 'fallback_bot_id', type: 'bigint', nullable: true })
  fallbackBotId!: number | null;

  @Column({ name: 'required_skills', type: 'json', nullable: true })
  requiredSkills!: unknown[] | null;

  @Column({ name: 'record_calls', default: true })
  recordCalls!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
