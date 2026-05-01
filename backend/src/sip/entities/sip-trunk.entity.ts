import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SipTransport = 'udp' | 'tcp' | 'tls';
export type SipDirection = 'inbound' | 'outbound' | 'both';
export type SipStatus = 'active' | 'inactive' | 'error' | 'registering';
export type SrtpMode = 'disabled' | 'optional' | 'required';

@Entity('sip_trunks')
@Index('idx_trunk_company', ['companyId'])
export class SipTrunk {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  host!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proxy!: string | null;

  @Column({ type: 'int', default: 5060 })
  port!: number;

  @Column({ type: 'varchar', length: 150 })
  username!: string;

  @Column({ name: 'auth_username', type: 'varchar', length: 150, nullable: true })
  authUsername!: string | null;

  @Column({ name: 'password_encrypted', type: 'text' })
  passwordEncrypted!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain!: string | null;

  @Column({ name: 'caller_id', type: 'varchar', length: 100, nullable: true })
  callerId!: string | null;

  @Column({ type: 'enum', enum: ['udp', 'tcp', 'tls'], default: 'udp' })
  transport!: SipTransport;

  @Column({ type: 'json', nullable: true })
  codecs!: string[] | null;

  @Column({ name: 'nat_enabled', default: true })
  natEnabled!: boolean;

  @Column({ name: 'ice_enabled', default: false })
  iceEnabled!: boolean;

  @Column({ name: 'rewrite_contact', default: true })
  rewriteContact!: boolean;

  @Column({ name: 'register_interval', type: 'int', default: 300 })
  registerInterval!: number;

  @Column({ name: 'keep_alive_interval', type: 'int', default: 15 })
  keepAliveInterval!: number;

  @Column({ name: 'encrypted_communication', default: false })
  encryptedCommunication!: boolean;

  @Column({ name: 'srtp_mode', type: 'enum', enum: ['disabled', 'optional', 'required'], default: 'disabled' })
  srtpMode!: SrtpMode;

  @Column({ type: 'enum', enum: ['inbound', 'outbound', 'both'], default: 'both' })
  direction!: SipDirection;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'fallback_trunk_id', type: 'bigint', nullable: true })
  fallbackTrunkId!: number | null;

  @Column({ name: 'max_concurrent_calls', type: 'int', nullable: true })
  maxConcurrentCalls!: number | null;

  @Column({ name: 'advanced_config', type: 'json', nullable: true })
  advancedConfig!: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: ['active', 'inactive', 'error', 'registering'], default: 'inactive' })
  status!: SipStatus;

  @Column({ name: 'last_registered_at', type: 'timestamp', nullable: true })
  lastRegisteredAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
