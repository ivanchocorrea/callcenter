import { Logger } from '@nestjs/common';
import { StorageDriver, StoragePutInput } from '../storage.types';

/**
 * S3-compatible driver. Cubre AWS S3, MinIO, Wasabi, Backblaze B2 (S3 API).
 * Usa carga dinámica de `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner`
 * para no romper si el paquete no está instalado en dev.
 */
export class S3Driver implements StorageDriver {
  readonly driverName: 's3' | 'minio' | 'wasabi' | 'backblaze';
  private readonly logger = new Logger(S3Driver.name);
  private client: any = null;

  constructor(
    private readonly cfg: {
      driver: 's3' | 'minio' | 'wasabi' | 'backblaze';
      endpoint?: string;
      region: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle: boolean;
    },
  ) {
    this.driverName = cfg.driver;
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    let mod: any;
    try {
      mod = require('@aws-sdk/client-s3');
    } catch {
      throw new Error('Paquete @aws-sdk/client-s3 no instalado; instala para usar driver S3');
    }
    const { S3Client } = mod;
    this.client = new S3Client({
      region: this.cfg.region,
      endpoint: this.cfg.endpoint,
      forcePathStyle: this.cfg.forcePathStyle,
      credentials: {
        accessKeyId: this.cfg.accessKey,
        secretAccessKey: this.cfg.secretKey,
      },
    });
    return this.client;
  }

  async put(input: StoragePutInput): Promise<{ path: string }> {
    const c = await this.getClient();
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await c.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: input.key,
        Body: input.body as any,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );
    return { path: `${this.driverName}://${this.cfg.bucket}/${input.key}` };
  }

  async get(key: string): Promise<Buffer> {
    const c = await this.getClient();
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const out = await c.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of out.Body) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const c = await this.getClient();
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await c.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }

  async presignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const c = await this.getClient();
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    let presigner: any;
    try {
      presigner = require('@aws-sdk/s3-request-presigner');
    } catch {
      throw new Error('@aws-sdk/s3-request-presigner no instalado');
    }
    return presigner.getSignedUrl(c, new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }), { expiresIn: expiresInSeconds });
  }
}
