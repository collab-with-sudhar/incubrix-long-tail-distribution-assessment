import crypto from 'crypto';
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
  // Configured to 1 minute for interactive testing and prompt freshness
  private ttlMs: number = 60 * 1000;

  public get(key: string): CachedResponse | 'PROCESSING' | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry === 'PROCESSING') return 'PROCESSING';
    // Expire after TTL window (1 minute)
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
    this.cache.set(key, {
      status,
      body,
      headers,
      payloadHash,
      timestamp: Date.now()
    });
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const globalIdempotencyStore = new IdempotencyStore();

export function idempotencyMiddleware(store: IdempotencyStore = globalIdempotencyStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only applies to mutating methods
    if (req.method !== 'POST') {
      return next();
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.body && req.body.idempotency_key);

    if (!idempotencyKey) {
      return next();
    }

    const currentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    const cached = store.get(idempotencyKey);

    if (cached === 'PROCESSING') {
      res.status(409).json({
        error: {
          code: 'IDEMPOTENT_OPERATION_IN_FLIGHT',
          message: 'An identical operation is currently being processed for this Idempotency-Key',
          retryable: true
        }
      });
      return;
    }

    // Only replay if cached within the 1-minute TTL AND identical payload
    if (cached && typeof cached === 'object') {
      if (!cached.payloadHash || cached.payloadHash === currentHash) {
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.status(cached.status).json(cached.body);
        return;
      }
      // If the payload changed, treat as a new distinct request
      store.clear();
    }

    // Mark as in progress
    store.setProcessing(idempotencyKey);

    // Intercept res.json to cache response upon completion
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      store.setCompleted(idempotencyKey, res.statusCode, body, currentHash);
      return originalJson(body);
    };

    next();
  };
}
