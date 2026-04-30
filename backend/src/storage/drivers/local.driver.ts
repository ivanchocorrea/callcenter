import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageDriver, StoragePutInput } from '../storage.types';

export class LocalDriver implements StorageDriver {
  readonly driverName = 'local' as const;
  private readonly logger = new Logger(LocalDriver.name);

  constructor(private readonly basePath: string) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  async put(input: StoragePutInput): Promise<{ path: string }> {
    const fullPath = path.join(this.basePath, input.key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (Buffer.isBuffer(input.body)) {
      fs.writeFileSync(fullPath, input.body);
    } else {
      const ws = fs.createWriteStream(fullPath);
      await new Promise<void>((resolve, reject) => {
        (input.body as NodeJS.ReadableStream).pipe(ws).on('finish', resolve).on('error', reject);
      });
    }
    return { path: fullPath };
  }

  async get(key: string): Promise<Buffer> {
    return fs.promises.readFile(path.join(this.basePath, key));
  }

  async delete(key: string): Promise<void> {
    const p = path.join(this.basePath, key);
    if (fs.existsSync(p)) await fs.promises.unlink(p);
  }

  async presignedUrl(key: string): Promise<string> {
    // Local no soporta presigning real; el backend stream-ea via /api/recordings/:id/stream
    return `local://${this.basePath}/${key}`;
  }
}
