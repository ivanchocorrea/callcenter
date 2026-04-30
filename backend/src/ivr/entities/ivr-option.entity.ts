import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ivr_options')
@Index('uniq_ivr_opt', ['ivrMenuId', 'dtmfKey'], { unique: true })
export class IvrOption {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ name: 'ivr_menu_id', type: 'bigint' })
  ivrMenuId!: number;

  @Column({ name: 'dtmf_key', length: 4 })
  dtmfKey!: string;

  @Column({ length: 150, nullable: true })
  label!: string | null;

  @Column({
    name: 'destination_type',
    type: 'enum',
    enum: ['queue', 'agent', 'bot', 'ivr', 'voicemail', 'webhook', 'hangup', 'tool', 'external'],
  })
  destinationType!: string;

  @Column({ name: 'destination_id', type: 'bigint', nullable: true })
  destinationId!: number | null;

  @Column({ name: 'destination_value', length: 255, nullable: true })
  destinationValue!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
