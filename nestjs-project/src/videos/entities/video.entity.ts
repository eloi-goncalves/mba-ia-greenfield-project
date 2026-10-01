import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';

export enum VideoStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export interface VideoMetadata {
  width?: number;
  height?: number;
  codec?: string;
  [key: string]: unknown;
}

const bigintTransformer = {
  to: (value: number | null): string | null =>
    value === null || value === undefined ? null : String(value),
  from: (value: string | null): number | null =>
    value === null || value === undefined ? null : Number(value),
};

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  public_id: string;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Index()
  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.DRAFT,
  })
  status: VideoStatus;

  @Column({ type: 'varchar' })
  source_key: string;

  @Column({ type: 'varchar', nullable: true })
  thumbnail_key: string | null;

  @Column({ type: 'int', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  size_bytes: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: VideoMetadata | null;

  @Column({ type: 'text', nullable: true })
  error_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;
}
