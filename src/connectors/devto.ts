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
    if (process.env.SIMULATION_MODE === 'true') {
      const mockPostId = `dev_${Date.now()}`;
      return {
        platform_post_id: mockPostId,
        live_url: `https://dev.to/article/${mockPostId}`,
        status: 'published'
      };
    }

    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    if (!apiKey) {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Missing Dev.to API Key', 401);
    }

    try {
      const response = await axios.post(
        'https://dev.to/api/articles',
        {
          article: {
            title: rendition.title || 'Technical Article',
            body_markdown: rendition.body,
            published: true,
            tags: rendition.tags || ['incubrix', 'tech'],
            canonical_url: rendition.canonical_url
          }
        },
        {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const postId = String(response.data.id);
      return {
        platform_post_id: postId,
        live_url: response.data.url,
        status: 'published'
      };
    } catch (err: any) {
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
    if (process.env.SIMULATION_MODE === 'true') {
      return {
        status: 'published',
        live_url: `https://dev.to/article/${platformPostId}`
      };
    }

    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    try {
      const res = await axios.get(`https://dev.to/api/articles/${platformPostId}`, {
        headers: { 'api-key': apiKey || '' }
      });
      return {
        status: res.data ? 'published' : 'removed',
        live_url: res.data?.url
      };
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        return { status: 'removed' };
      }
      throw new AppError(this.mapError(status), err.message, status || 500);
    }
  }

  public async delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult> {
    if (process.env.SIMULATION_MODE === 'true') {
      return { deleted: true };
    }

    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
    try {
      // Dev.to allows unpublishing or deleting
      await axios.put(
        `https://dev.to/api/articles/${platformPostId}`,
        {
          article: { published: false }
        },
        {
          headers: { 'api-key': apiKey || '' }
        }
      );
      return { deleted: true };
    } catch (err: any) {
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
      return { views: 520, likes: 45, comments: 12, clicks: 38 };
    }

    const apiKey = connection.api_key || process.env.DEVTO_API_KEY;
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
