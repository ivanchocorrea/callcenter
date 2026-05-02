import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CallDirection = 'inbound' | 'outbound' | 'internal';
export type CallStatus =
  | 'initiated' | 'ringing' | 'in_queue' | 'in_ivr' | 'in_bot'
  | 'answered' | 'on_hold' | 'transferred' | 'completed'
  | 'no_answer' | 'busy' | 'failed' | 'abandoned' | 'voicemail';

@Entity('calls')
@Index('idx_calls_company_started', ['companyId', 'startedAt'])
@Index('idx_calls_agent', ['agentId', 'startedAt'])
@Index('idx_calls_status', ['status'])
@Index('idx_calls_uniqueid', ['asteriskUniqueid'])
@Index('idx_calls_customer', ['customerId'])
export class Call {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ name: 'asterisk_uniqueid', type: 'varchar', length: 80, nullable: true })
  asteriskUniqueid!: string | null;

  @Column({ name: 'asterisk_linkedid', type: 'varchar', length: 80, nullable: true })
  asteriskLinkedid!: string | null;

  @Column({ type: 'enum', enum: ['inbound', 'outbound', 'internal'] })
  direction!: CallDirection;

  @Column({ name: 'from_number', type: 'varchar', length: 60, nullable: true })
  fromNumber!: string | null;

  @Column({ name: 'to_number', type: 'varchar', length: 60, nullable: true })
  toNumber!: string | null;

  @Column({ name: 'did_number', type: 'varchar', length: 60, nullable: true })
  didNumber!: string | null;

  @Column({ name: 'trunk_id', type: 'bigint', nullable: true })
  trunkId!: number | null;

  @Column({ name: 'customer_id', type: 'bigint', nullable: true })
  customerId!: number | null;

  @Column({ name: 'queue_id', type: 'bigint', nullable: true })
  queueId!: number | null;

  @Column({ name: 'ivr_menu_id', type: 'bigint', nullable: true })
  ivrMenuId!: number | null;

  @Column({ name: 'bot_id', type: 'bigint', nullable: true })
  botId!: number | null;

  @Column({ name: 'campaign_id', type: 'bigint', nullable: true })
  campaignId!: number | null;

  @Column({ name: 'agent_id', type: 'bigint', nullable: true })
  agentId!: number | null;

  @Column({
    type: 'enum',
    enum: [
      'initiated','ringing','in_queue','in_ivr','in_bot',
      'answered','on_hold','transferred','completed',
      'no_answer','busy','failed','abandoned','voicemail',
    ],
    default: 'initiated',
  })
  status!: CallStatus;

  @Column({ name: 'disposition_id', type: 'bigint', nullable: true })
  dispositionId!: number | null;

  /** Notas del agente durante o después de la llamada. */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'is_recorded', default: false })
  isRecorded!: boolean;

  @Column({ name: 'recording_id', type: 'bigint', nullable: true })
  recordingId!: number | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ringing_at', type: 'timestamp', nullable: true })
  ringingAt!: Date | null;

  @Column({ name: 'answered_at', type: 'timestamp', nullable: true })
  answeredAt!: Date | null;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'queue_wait_seconds', type: 'int', nullable: true })
  queueWaitSeconds!: number | null;

  @Column({ name: 'talk_seconds', type: 'int', nullable: true })
  talkSeconds!: number | null;

  @Column({ name: 'hold_seconds', type: 'int', nullable: true })
  holdSeconds!: number | null;

  @Column({ name: 'wrap_up_seconds', type: 'int', nullable: true })
  wrapUpSeconds!: number | null;

  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary!: string | null;

  @Column({ name: 'ai_sentiment', type: 'varchar', length: 20, nullable: true })
  aiSentiment!: string | null;

  @Column({ name: 'ai_tags', type: 'json', nullable: true })
  aiTags!: unknown[] | null;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
