import crypto from 'crypto';
import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  status: number;
  headers: Record<string, any>;
  body: any;
  payloadHash?: string;
  timestamp: number;
}

export class IdempotencyStore {
  private cache: Map<string, CachedResponse | 'PROCESSING'> = new Map();
  private emitter: EventEmitter = new EventEmitter();
  // Must-Have 6 & Must-Have 5: 10 minutes TTL window (600,000 ms)
  private ttlMs: number = 10 * 60 * 1000;

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  public get(key: string): CachedResponse | 'PROCESSING' | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry === 'PROCESSING') return 'PROCESSING';
    // Expire after TTL window
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry;
  }

  public setProcessing(key: string): void {
    this.cache.set(key, 'PROCESSING');
  }

  public setCompleted(
    key: string,
    status: number,
    body: any,
    payloadHash?: string,
    headers: Record<string, any> = {}
  ): void {
    const record: CachedResponse = {
      status,
      body,
      headers,
      payloadHash,
      timestamp: Date.now()
    };
    this.cache.set(key, record);
    this.emitter.emit(`done:${key}`, record);
  }

  public notifyFailed(key: string, status: number, body: any): void {
    this.cache.delete(key);
    this.emitter.emit(`fail:${key}`, { status, body });
  }

  public waitForCompletion(key: string, timeoutMs: number = 15000): Promise<CachedResponse | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);

      const onDone = (result: CachedResponse) => {
        cleanup();
        resolve(result);
      };

      const onFail = () => {
        cleanup();
        resolve(null);
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.emitter.removeListener(`done:${key}`, onDone);
        this.emitter.removeListener(`fail:${key}`, onFail);
      };

      this.emitter.once(`done:${key}`, onDone);
      this.emitter.once(`fail:${key}`, onFail);
    });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const globalIdempotencyStore = new IdempotencyStore();

export function idempotencyMiddleware(store: IdempotencyStore = globalIdempotencyStore) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only applies to mutating methods on non-mock API endpoints
    if (req.method !== 'POST' || req.path.startsWith('/mock')) {
      return next();
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['x-idempotency-key'] as string) ||
      (req.body && (req.body.idempotency_key || req.body.idempotencyKey));

    if (!idempotencyKey) {
      return next();
    }

    const currentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    let cached = store.get(idempotencyKey);

    // If an identical operation is currently in flight, wait for it to complete
    if (cached === 'PROCESSING') {
      const completed = await store.waitForCompletion(idempotencyKey, 15000);
      if (completed) {
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.status(completed.status).json(completed.body);
        return;
      }
      // If it timed out waiting for the in-flight operation
      res.status(409).json({
        error: {
          code: 'IDEMPOTENT_OPERATION_IN_FLIGHT',
          message: 'An identical operation is currently being processed for this Idempotency-Key',
          retryable: true
        }
      });
      return;
    }

    // Replay if cached within TTL and identical payload
    if (cached && typeof cached === 'object') {
      if (!cached.payloadHash || cached.payloadHash === currentHash) {
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.status(cached.status).json(cached.body);
        return;
      }
      // If the payload changed for this key, remove old cache entry and process new payload
      store.delete(idempotencyKey);
    }

    // Mark as in progress
    store.setProcessing(idempotencyKey);

    // Intercept res.json to cache response upon completion
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.setCompleted(idempotencyKey, res.statusCode, body, currentHash);
      } else {
        // On error, release processing lock so retry attempts can proceed
        store.notifyFailed(idempotencyKey, res.statusCode, body);
      }
      return originalJson(body);
    };

    next();
  };
}
