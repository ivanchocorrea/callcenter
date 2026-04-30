import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserStatus = 'active' | 'disabled' | 'locked' | 'pending';

@Entity('users')
@Index('idx_users_email', ['email'])
@Index('idx_users_status', ['status'])
@Index('uniq_users_company_email', ['companyId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint', nullable: true })
  companyId!: number | null;

  @Column({ length: 180 })
  email!: string;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ name: 'full_name', length: 180 })
  fullName!: string;

  @Column({ name: 'display_name', length: 120, nullable: true })
  displayName!: string | null;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ length: 40, nullable: true })
  phone!: string | null;

  @Column({ length: 80, nullable: true })
  timezone!: string | null;

  @Column({ length: 10, nullable: true })
  locale!: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'disabled', 'locked', 'pending'],
    default: 'active',
  })
  status!: UserStatus;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'last_login_ip', length: 50, nullable: true })
  lastLoginIp!: string | null;

  @Column({ name: 'failed_login_count', type: 'int', default: 0 })
  failedLoginCount!: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled!: boolean;

  @Column({ name: 'two_factor_secret_encrypted', type: 'text', nullable: true })
  twoFactorSecretEncrypted!: string | null;

  @Column({ name: 'sso_provider', length: 60, nullable: true })
  ssoProvider!: string | null;

  @Column({ name: 'sso_external_id', length: 200, nullable: true })
  ssoExternalId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
