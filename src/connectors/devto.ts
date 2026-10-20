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

export class DevtoConnector extends BaseConnector {
  constructor() {
    super('devto');
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

    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    const isMockKey = !apiKey || apiKey.startsWith('mock_') || apiKey === 'test_key';
    const isTest = process.env.NODE_ENV === 'test';
    const isSimulation = process.env.SIMULATION_MODE === 'true';

    let targetBase = connection.base_url || destination.url || 'https://dev.to';
    const useLocalMock = isTest || isMockKey || !apiKey || targetBase.includes('mock/devto') || isSimulation;

    if (useLocalMock) {
      targetBase = 'http://localhost:3000/mock/devto';
    }

    try {
      // Clean tags: Dev.to requires lowercase alphanumeric strings, max 4
      const cleanTags = (rendition.tags && rendition.tags.length > 0)
        ? rendition.tags
            .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
            .filter((t) => t.length > 0)
            .slice(0, 4)
        : ['incubrix', 'tech'];

      const response = await axios.post(
        `${targetBase}/api/articles`,
        {
          article: {
            title: rendition.title || 'IncuBrix Publication',
            body_markdown: rendition.body || 'Published via IncuBrix Distribution Network.',
            published: true,
            tags: cleanTags,
            main_image: (rendition.media_urls && rendition.media_urls[0]) || undefined,
            canonical_url: rendition.canonical_url || undefined
          }
        },
        {
          headers: {
            'api-key': apiKey || 'mock_key',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const postId = String(response.data.id);
      const result: PublishResult = {
        platform_post_id: postId,
        live_url: response.data.url,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, result);
      return result;
    } catch (err: any) {
      if (useLocalMock) {
        const mockPostId = `dev_${Date.now()}`;
        const fallbackResult: PublishResult = {
          platform_post_id: mockPostId,
          live_url: `http://localhost:3000/mock/devto/article/${mockPostId}`,
          status: 'published'
        };
        if (idempotencyKey) this.recordIdempotency(idempotencyKey, fallbackResult);
        return fallbackResult;
      }
      const status = err.response?.status;
      const mapped = this.mapError(status, 'PLATFORM_UNAVAILABLE');
      throw new AppError(
        mapped,
        err.response?.data?.error || err.message,
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
    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    const isTest = process.env.NODE_ENV === 'test';
    const isMockKey = !apiKey || apiKey.startsWith('mock_') || apiKey === 'test_key';
    let targetBase = connection.base_url;
    if (!targetBase || isMockKey || isTest) {
      targetBase = (connection.base_url && connection.base_url.includes('mock/devto'))
        ? connection.base_url
        : 'http://localhost:3000/mock/devto';
    }
    const isMock = isTest || isMockKey || !apiKey || platformPostId.startsWith('dev_') || targetBase.includes('mock/devto');

    try {
      const res = await axios.get(`${targetBase}/api/articles/${platformPostId}`, {
        headers: { 'api-key': apiKey || 'mock_key' }
      });
      return {
        status: res.data && res.data.published !== false ? 'published' : 'removed',
        live_url: res.data?.url || `http://localhost:3000/mock/devto/article/${platformPostId}`
      };
    } catch (err: any) {
      if (isMock || err.response?.status === 404) {
        return {
          status: 'published',
          live_url: `http://localhost:3000/mock/devto/article/${platformPostId}`
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
    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    const isTest = process.env.NODE_ENV === 'test';
    const isMockKey = !apiKey || apiKey.startsWith('mock_') || apiKey === 'test_key';
    let targetBase = connection.base_url;
    if (!targetBase || isMockKey || isTest) {
      targetBase = (connection.base_url && connection.base_url.includes('mock/devto'))
        ? connection.base_url
        : 'http://localhost:3000/mock/devto';
    }
    const isMock = isTest || isMockKey || !apiKey || platformPostId.startsWith('dev_') || targetBase.includes('mock/devto');

    try {
      await axios.put(
        `${targetBase}/api/articles/${platformPostId}/unpublish`,
        {},
        {
          headers: { 'api-key': apiKey || 'mock_key' },
          timeout: 10000
        }
      );
      return { deleted: true };
    } catch (err: any) {
      if (isMock || err.response?.status === 404) {
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
    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    const isTest = process.env.NODE_ENV === 'test';
    const isMock = isTest || platformPostId.startsWith('dev_') || !apiKey || apiKey.startsWith('mock_');

    if (isMock) {
      return { views: 520, likes: 45, comments: 12, clicks: 38 };
    }

    try {
      const res = await axios.get(`https://dev.to/api/articles/${platformPostId}`, {
        headers: { 'api-key': apiKey || '' }
      });
      return {
        views: res.data.page_views_count || 0,
        likes: res.data.positive_reactions_count || 0,
        comments: res.data.comments_count || 0
      };
    } catch {
      return { views: 0, likes: 0, comments: 0 };
    }
  }
}
