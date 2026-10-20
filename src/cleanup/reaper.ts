import { Destination, Connection } from '../types/contract.js';
import { globalRegistry } from '../connectors/registry.js';
import { Logger } from '../utils/logger.js';

export interface TrackedTestPost {
  id: string;
  platformPostId: string;
  connectorKey: string;
  destination: Destination;
  connection: Connection;
  title: string;
  publishedAt: number;
  deleteAfterMs: number; // Defaults to 10 minutes (600,000 ms per Must-Have 5)
  deleted: boolean;
  deletedAt?: number;
  error?: string;
}

export class TestPostReaper {
  private posts: Map<string, TrackedTestPost> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  // Must-Have 5: Test posts deleted within 10 minutes
  public defaultTtlMs = 10 * 60 * 1000;

  public start(checkIntervalMs: number = 30000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.reapExpired();
    }, checkIntervalMs);
    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
    Logger.info('Must-Have 5: Test Post Auto-Cleanup Reaper started (10-minute auto-deletion limit)');
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public track(entry: {
    platformPostId: string;
    connectorKey: string;
    destination: Destination;
    connection?: Connection;
    title?: string;
    deleteAfterMs?: number;
  }): TrackedTestPost {
    const id = `reap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: TrackedTestPost = {
      id,
      platformPostId: entry.platformPostId,
      connectorKey: entry.connectorKey,
      destination: entry.destination,
      connection: entry.connection || {},
      title: entry.title || 'IncuBrix Test Post',
      publishedAt: Date.now(),
      deleteAfterMs: entry.deleteAfterMs || this.defaultTtlMs,
      deleted: false
    };
    this.posts.set(id, record);
    Logger.info(`Must-Have 5: Tracked test post for automatic deletion within 10 minutes`, {
      post_id: record.platformPostId,
      destination: record.destination.name,
      connector: record.connectorKey,
      scheduled_delete_at: new Date(record.publishedAt + record.deleteAfterMs).toISOString()
    });
    return record;
  }

  public async reapExpired(): Promise<number> {
    const now = Date.now();
    let reapedCount = 0;

    for (const [id, post] of this.posts.entries()) {
      if (post.deleted) continue;

      if (now - post.publishedAt >= post.deleteAfterMs) {
        try {
          const connector = globalRegistry.get(post.connectorKey);
          await connector.delete(post.platformPostId, post.connection);
          post.deleted = true;
          post.deletedAt = Date.now();
          reapedCount++;
          Logger.info(`Must-Have 5: Auto-deleted test post within 10 minutes limit`, {
            post_id: post.platformPostId,
            destination: post.destination.name,
            connector: post.connectorKey,
            age_seconds: Math.round((post.deletedAt - post.publishedAt) / 1000)
          });
        } catch (err: any) {
          post.error = err.message;
          Logger.warn(`Failed to auto-delete test post ${post.platformPostId}`, { error: err.message });
        }
      }
    }
    return reapedCount;
  }

  public async purgeAll(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    for (const [id, post] of this.posts.entries()) {
      if (post.deleted) continue;
      try {
        const connector = globalRegistry.get(post.connectorKey);
        await connector.delete(post.platformPostId, post.connection);
        post.deleted = true;
        post.deletedAt = Date.now();
        deleted++;
        Logger.info(`Must-Have 5: Purged test post on demand`, {
          post_id: post.platformPostId,
          destination: post.destination.name
        });
      } catch (err: any) {
        post.error = err.message;
        errors++;
      }
    }
    return { deleted, errors };
  }

  public list(): (TrackedTestPost & { remaining_seconds: number })[] {
    const now = Date.now();
    return Array.from(this.posts.values()).map(p => ({
      ...p,
      remaining_seconds: p.deleted ? 0 : Math.max(0, Math.round((p.publishedAt + p.deleteAfterMs - now) / 1000))
    }));
  }
}

export const globalTestPostReaper = new TestPostReaper();
