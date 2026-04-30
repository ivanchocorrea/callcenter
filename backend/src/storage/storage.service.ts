import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LocalDriver } from './drivers/local.driver';
import { S3Driver } from './drivers/s3.driver';
import { StorageDriver } from './storage.types';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private cache = new Map<number, StorageDriver>();

  constructor(
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /** Driver por empresa: usa storage_providers.is_default = TRUE o cae a local. */
  async driverFor(companyId: number): Promise<StorageDriver> {
    if (this.cache.has(companyId)) return this.cache.get(companyId)!;
    const rows = await this.ds.query(
      `SELECT * FROM storage_providers WHERE company_id = ? AND is_active = TRUE AND is_default = TRUE LIMIT 1`,
      [companyId],
    );
    let driver: StorageDriver;
    if (rows[0]) {
      const r = rows[0];
      if (r.driver === 'local') {
        driver = new LocalDriver(r.base_path ?? this.config.get<string>('storage.localPath') ?? '/var/recordings');
      } else {
        driver = new S3Driver({
          driver: r.driver,
          endpoint: r.endpoint ?? undefined,
          region: r.region ?? 'us-east-1',
          bucket: r.bucket,
          accessKey: r.access_key_encrypted ? this.encryption.decrypt(r.access_key_encrypted) : '',
          secretKey: r.secret_key_encrypted ? this.encryption.decrypt(r.secret_key_encrypted) : '',
          forcePathStyle: !!r.use_path_style,
        });
      }
    } else {
      driver = new LocalDriver(this.config.get<string>('storage.localPath') ?? '/var/recordings');
    }
    this.cache.set(companyId, driver);
    return driver;
  }

  invalidateCompany(companyId: number) { this.cache.delete(companyId); }
}
