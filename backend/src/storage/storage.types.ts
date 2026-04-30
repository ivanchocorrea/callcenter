export interface StoragePutInput {
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageDriver {
  driverName: 'local' | 's3' | 'minio' | 'wasabi' | 'backblaze';
  put(input: StoragePutInput): Promise<{ path: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  presignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
