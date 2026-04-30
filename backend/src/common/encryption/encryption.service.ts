import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM con master key de 32 bytes (64 hex chars).
 * Formato del string cifrado: base64url(  iv(12) | tag(16) | cipher(...)  )
 *
 * Uso:
 *   const enc = encryptionService.encrypt('mi password sip');
 *   const dec = encryptionService.decrypt(enc);
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private masterKey!: Buffer;
  private static readonly ALG = 'aes-256-gcm';
  private static readonly IV_LEN = 12;
  private static readonly TAG_LEN = 16;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const hex = this.config.get<string>('jwt.encryptionMasterKey');
    if (!hex || hex.length !== 64) {
      throw new Error('ENCRYPTION_MASTER_KEY debe tener exactamente 64 chars hex (32 bytes).');
    }
    this.masterKey = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    if (plaintext == null) return plaintext as unknown as string;
    const iv = crypto.randomBytes(EncryptionService.IV_LEN);
    const cipher = crypto.createCipheriv(EncryptionService.ALG, this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return ciphertext;
    const buf = Buffer.from(ciphertext, 'base64url');
    const iv = buf.subarray(0, EncryptionService.IV_LEN);
    const tag = buf.subarray(EncryptionService.IV_LEN, EncryptionService.IV_LEN + EncryptionService.TAG_LEN);
    const data = buf.subarray(EncryptionService.IV_LEN + EncryptionService.TAG_LEN);
    const decipher = crypto.createDecipheriv(EncryptionService.ALG, this.masterKey, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  }

  /** HMAC-SHA256 firma para webhooks y otros usos. */
  hmacSha256(message: string | Buffer, secret: string): string {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  /** Token aleatorio URL-safe (32 bytes → 43 chars). */
  generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }

  /** Hash de un token (para guardarlo) usando SHA-256. */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
