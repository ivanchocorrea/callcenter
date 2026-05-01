import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ivr_audio_files')
@Index('idx_iaf_company', ['companyId'])
export class IvrAudioFile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'company_id', type: 'bigint' })
  companyId!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ name: 'storage_provider_id', type: 'bigint', nullable: true })
  storageProviderId!: number | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes!: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  format!: string | null;

  @Column({ name: 'sample_rate', type: 'int', nullable: true })
  sampleRate!: number | null;

  @Column({
    type: 'enum',
    enum: ['welcome', 'menu', 'wait', 'moh', 'out_of_hours', 'invalid_option', 'timeout', 'recording_disclosure', 'position', 'custom'],
    default: 'custom',
  })
  purpose!: string;

  @Column({ type: 'text', nullable: true })
  transcription!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
