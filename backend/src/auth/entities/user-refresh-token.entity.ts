import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_refresh_tokens')
@Index('idx_urt_user', ['userId'])
@Index('idx_urt_expires', ['expiresAt'])
export class UserRefreshToken {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number;

  @Column({ name: 'token_hash', length: 255 })
  tokenHash!: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', length: 50, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'replaced_by', type: 'bigint', nullable: true })
  replacedBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
