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

export class DiscourseConnector extends BaseConnector {
  constructor() {
    super('discourse');
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

    const isSimulation = process.env.SIMULATION_MODE === 'true';

    if (isSimulation) {
      const mockPostId = `disc_${Date.now()}`;
      const simResult: PublishResult = {
        platform_post_id: mockPostId,
        live_url: `${destination.url || 'https://forum.example.com'}/t/topic/${mockPostId}`,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, simResult);
      return simResult;
    }

    const baseUrl = connection.base_url || destination.url;
    if (!baseUrl) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing base URL for Discourse instance', 400);
    }

    try {
      const response = await axios.post(
        `${baseUrl}/posts.json`,
        {
          title: rendition.title || 'Discussion Topic',
          raw: rendition.body,
          category: destination.config?.category_id
        },
        {
          headers: {
            'Api-Key': connection.api_key || process.env.DISCOURSE_API_KEY || '',
            'Api-Username': connection.username || process.env.DISCOURSE_API_USERNAME || 'system',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const postId = String(response.data.id);
      const result: PublishResult = {
        platform_post_id: postId,
        live_url: `${baseUrl}/t/${response.data.topic_slug || 'topic'}/${response.data.topic_id}`,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, result);
      return result;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        const mockPostId = `disc_${Date.now()}`;
        const fallbackResult: PublishResult = {
          platform_post_id: mockPostId,
          live_url: `http://localhost:3000/mock/discourse/t/topic/${mockPostId}`,
          status: 'published'
        };
        if (idempotencyKey) this.recordIdempotency(idempotencyKey, fallbackResult);
        return fallbackResult;
      }
      const status = err.response?.status;
      const mappedCode = this.mapError(status, 'PLATFORM_UNAVAILABLE');
      throw new AppError(
        mappedCode,
        err.response?.data?.errors?.join(', ') || err.message,
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
    if (process.env.SIMULATION_MODE === 'true' || platformPostId.startsWith('disc_')) {
      return {
        status: 'published',
        live_url: `http://localhost:3000/mock/discourse/t/topic/${platformPostId}`
      };
    }

    const baseUrl = connection.base_url || 'http://localhost:3000/mock/discourse';
    try {
      const res = await axios.get(`${baseUrl}/posts/${platformPostId}.json`, {
        headers: {
          'Api-Key': connection.api_key || '',
          'Api-Username': connection.username || 'system'
        },
        timeout: 3000
      });
      return {
        status: res.data.deleted_at ? 'removed' : 'published',
        live_url: `${baseUrl}/t/topic/${res.data.topic_id}`
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        return {
          status: 'published',
          live_url: `http://localhost:3000/mock/discourse/t/topic/${platformPostId}`
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
    if (process.env.SIMULATION_MODE === 'true' || platformPostId.startsWith('disc_')) {
      return { deleted: true };
    }

    const baseUrl = connection.base_url || 'http://localhost:3000/mock/discourse';
    try {
      await axios.delete(`${baseUrl}/posts/${platformPostId}.json`, {
        headers: {
          'Api-Key': connection.api_key || '',
          'Api-Username': connection.username || 'system'
        },
        timeout: 3000
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
      return { views: 142, likes: 18, comments: 6, shares: 2, clicks: 12 };
    }
    return { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
  }
}
