import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ length: 120, unique: true })
  slug!: string;

  @Column({ length: 80 })
  resource!: string;

  @Column({ length: 80 })
  action!: string;

  @Column({ length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'is_dangerous', default: false })
  isDangerous!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
