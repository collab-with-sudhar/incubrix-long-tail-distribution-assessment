import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  status: number;
  headers: Record<string, any>;
  body: any;
  timestamp: number;
}

export class IdempotencyStore {
  private cache: Map<string, CachedResponse | 'PROCESSING'> = new Map();
  private ttlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  public get(key: string): CachedResponse | 'PROCESSING' | undefined {
    return this.cache.get(key);
  }

  public setProcessing(key: string): void {
    this.cache.set(key, 'PROCESSING');
  }

  public setCompleted(key: string, status: number, body: any, headers: Record<string, any> = {}): void {
    this.cache.set(key, {
      status,
      body,
      headers,
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
    // Only applies to mutating methods (POST, PUT, PATCH, DELETE)
    if (req.method !== 'POST') {
      return next();
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.body && req.body.idempotency_key);

    if (!idempotencyKey) {
      // Allow proceeding if not required by specific route, or require it
      return next();
    }

    const cached = store.get(idempotencyKey);

    if (cached === 'PROCESSING') {
      // In-flight request with same idempotency key
      res.status(409).json({
        error: {
          code: 'IDEMPOTENT_OPERATION_IN_FLIGHT',
          message: 'An identical operation is currently being processed for this Idempotency-Key',
          retryable: true
        }
      });
      return;
    }

    if (cached && typeof cached === 'object') {
      // Already completed -> replay previous response safely
      res.setHeader('X-Cache-Lookup', 'HIT');
      res.status(cached.status).json(cached.body);
      return;
    }

    // Mark as in progress
    store.setProcessing(idempotencyKey);

    // Intercept res.json to cache response upon completion
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      // Only cache successful or non-server-crash responses
      store.setCompleted(idempotencyKey, res.statusCode, body);
      return originalJson(body);
    };

    next();
  };
}
