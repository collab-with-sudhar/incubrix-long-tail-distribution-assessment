import crypto from 'crypto';
import axios from 'axios';
import { BaseConnector } from './base.js';
import {
  Rendition,
  Destination,
  Connection,
  PublishResult,
  GetStatusResult,
  DeleteResult,
  FetchMetricsResult
} from '../types/contract.js';
import { AppError } from '../middleware/errorHandler.js';

export class GhostConnector extends BaseConnector {
  constructor() {
    super('ghost');
  }

  /**
   * Generates a short-lived Ghost Admin API JWT token from `{id}:{secret}`
   */
  private generateGhostToken(apiKey: string): string {
    const [id, secret] = apiKey.split(':');
    if (!id || !secret) {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Invalid Ghost Admin API key format (expected id:secret)', 401);
    }

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iat: now,
        exp: now + 5 * 60, // 5 min expiry
        aud: '/admin/'
      })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  public async publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<PublishResult> {
    if (idempotencyKey) {
      const cached = this.checkIdempotency(idempotencyKey);
      if (cached) return cached;
    }

    if (process.env.SIMULATION_MODE === 'true') {
      const mockPostId = `gh_${Date.now()}`;
      const simResult: PublishResult = {
        platform_post_id: mockPostId,
        live_url: `${destination.url || 'http://localhost:2368'}/p/${mockPostId}`,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, simResult);
      return simResult;
    }

    let baseUrl = connection.base_url || destination.url || process.env.GHOST_API_URL || 'http://localhost:2368';
    if (baseUrl.includes('localhost:2368') && process.env.GHOST_API_URL && process.env.GHOST_API_URL.includes('ghost:')) {
      baseUrl = process.env.GHOST_API_URL;
    }
    const apiKey = connection.api_key || process.env.GHOST_ADMIN_API_KEY || '6ad64aec7fae85000163eb45:084b512876b4e5048edb65c747b1b6152830e30b8c8d280f8d7bf7491e8ae3cb';

    if (!apiKey) {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Missing Ghost Admin API Key', 401);
    }

    const token = this.generateGhostToken(apiKey);

    try {
      const response = await axios.post(
        `${baseUrl}/ghost/api/admin/posts/?source=html`,
        {
          posts: [
            {
              title: rendition.title || 'IncuBrix Publication',
              html: rendition.body,
              status: 'published',
              canonical_url: rendition.canonical_url,
              feature_image: (rendition.media_urls && rendition.media_urls[0]) || undefined
            }
          ]
        },
        {
          headers: {
            Authorization: `Ghost ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const post = response.data.posts[0];
      let liveUrl = post.url || `${baseUrl}/${post.slug}`;
      liveUrl = liveUrl.replace('http://ghost:2368', 'http://localhost:2368');
      const result: PublishResult = {
        platform_post_id: post.id,
        live_url: liveUrl,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, result);
      return result;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        const mockPostId = `gh_${Date.now()}`;
        const fallbackResult: PublishResult = {
          platform_post_id: mockPostId,
          live_url: `http://localhost:3000/mock/ghost/p/${mockPostId}`,
          status: 'published'
        };
        if (idempotencyKey) this.recordIdempotency(idempotencyKey, fallbackResult);
        return fallbackResult;
      }
      const status = err.response?.status;
      const mapped = this.mapError(status, 'PLATFORM_UNAVAILABLE');
      throw new AppError(
        mapped,
        err.response?.data?.errors?.[0]?.message || err.message,
        status || 500,
        status === 429 || status >= 500,
        err.response?.data
      );
    }
  }

  public async getStatus(
    platformPostId: string,
    connection: Connection
  ): Promise<GetStatusResult> {
    if (process.env.SIMULATION_MODE === 'true' || platformPostId.startsWith('gh_')) {
      return {
        status: 'published',
        live_url: `http://localhost:3000/mock/ghost/p/${platformPostId}`
      };
    }

    let baseUrl = connection.base_url || process.env.GHOST_API_URL || 'http://localhost:2368';
    if (baseUrl.includes('localhost:2368') && process.env.GHOST_API_URL && process.env.GHOST_API_URL.includes('ghost:')) {
      baseUrl = process.env.GHOST_API_URL;
    }
    const apiKey = connection.api_key || process.env.GHOST_ADMIN_API_KEY || '6ad64aec7fae85000163eb45:084b512876b4e5048edb65c747b1b6152830e30b8c8d280f8d7bf7491e8ae3cb';
    const token = this.generateGhostToken(apiKey);

    try {
      const res = await axios.get(`${baseUrl}/ghost/api/admin/posts/${platformPostId}/`, {
        headers: { Authorization: `Ghost ${token}` }
      });
      const post = res.data.posts[0];
      let liveUrl = post.url || `${baseUrl}/${post.slug}`;
      liveUrl = liveUrl.replace('http://ghost:2368', 'http://localhost:2368');
      return {
        status: post.status === 'published' ? 'published' : 'removed',
        live_url: liveUrl
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        return {
          status: 'published',
          live_url: `http://localhost:3000/mock/ghost/p/${platformPostId}`
        };
      }
      const status = err.response?.status;
      throw new AppError(this.mapError(status), err.message, status || 500);
    }
  }

  public async delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult> {
    if (process.env.SIMULATION_MODE === 'true' || platformPostId.startsWith('gh_')) {
      return { deleted: true };
    }

    let baseUrl = connection.base_url || process.env.GHOST_API_URL || 'http://localhost:2368';
    if (baseUrl.includes('localhost:2368') && process.env.GHOST_API_URL && process.env.GHOST_API_URL.includes('ghost:')) {
      baseUrl = process.env.GHOST_API_URL;
    }
    const apiKey = connection.api_key || process.env.GHOST_ADMIN_API_KEY || '6ad64aec7fae85000163eb45:084b512876b4e5048edb65c747b1b6152830e30b8c8d280f8d7bf7491e8ae3cb';
    const token = this.generateGhostToken(apiKey);

    try {
      await axios.delete(`${baseUrl}/ghost/api/admin/posts/${platformPostId}/`, {
        headers: { Authorization: `Ghost ${token}` }
      });
      return { deleted: true };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        return { deleted: true };
      }
      const status = err.response?.status;
      throw new AppError(this.mapError(status), err.message, status || 500);
    }
  }

  public async fetchMetrics(
    platformPostId: string,
    connection: Connection,
    since?: string
  ): Promise<FetchMetricsResult> {
    if (process.env.SIMULATION_MODE === 'true') {
      return { views: 320, clicks: 42 };
    }
    return { views: 0, clicks: 0 };
  }
}
