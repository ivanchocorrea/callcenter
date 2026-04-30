import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Cliente Redis singleton + pub/sub helpers. */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subscriber!: Redis;
  private pubsubHandlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const opts = {
      host: this.config.get<string>('db.redis.host'),
      port: this.config.get<number>('db.redis.port'),
      password: this.config.get<string>('db.redis.password') || undefined,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    };
    this.client = new Redis(opts as any);
    this.subscriber = new Redis(opts as any);
    this.client.on('error', e => this.logger.error(`Redis error: ${e.message}`));
    this.subscriber.on('error', e => this.logger.error(`Redis subscriber error: ${e.message}`));

    this.subscriber.on('message', (channel, message) => {
      const handlers = this.pubsubHandlers.get(channel);
      if (!handlers) return;
      let payload: unknown = message;
      try { payload = JSON.parse(message); } catch { /* keep raw */ }
      for (const h of handlers) {
        try { h(payload); } catch (e: any) { this.logger.error(`pubsub handler error on ${channel}: ${e?.message}`); }
      }
    });
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
    await this.subscriber?.quit().catch(() => undefined);
  }

  // -------- básico --------
  get raw(): Redis { return this.client; }
  set(key: string, value: string, ttlSeconds?: number) {
    return ttlSeconds
      ? this.client.set(key, value, 'EX', ttlSeconds)
      : this.client.set(key, value);
  }
  get(key: string) { return this.client.get(key); }
  del(...keys: string[]) { return this.client.del(...keys); }
  expire(key: string, sec: number) { return this.client.expire(key, sec); }
  hset(key: string, hash: Record<string, string | number>) { return this.client.hset(key, hash as any); }
  hgetall(key: string) { return this.client.hgetall(key); }

  // -------- pub/sub --------
  async publish(channel: string, payload: unknown) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return this.client.publish(channel, data);
  }
  async subscribe(channel: string, handler: (payload: unknown) => void) {
    if (!this.pubsubHandlers.has(channel)) {
      this.pubsubHandlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.pubsubHandlers.get(channel)!.add(handler);
  }
  async unsubscribe(channel: string, handler?: (payload: unknown) => void) {
    const set = this.pubsubHandlers.get(channel);
    if (!set) return;
    if (handler) set.delete(handler);
    if (!handler || set.size === 0) {
      await this.subscriber.unsubscribe(channel);
      this.pubsubHandlers.delete(channel);
    }
  }
}
