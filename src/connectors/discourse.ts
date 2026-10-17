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
    const isSimulation = process.env.SIMULATION_MODE === 'true';

    if (isSimulation) {
      const mockPostId = `disc_${Date.now()}`;
      return {
        platform_post_id: mockPostId,
        live_url: `${destination.url || 'https://forum.example.com'}/t/topic/${mockPostId}`,
        status: 'published'
      };
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
      return {
        platform_post_id: postId,
        live_url: `${baseUrl}/t/${response.data.topic_slug || 'topic'}/${response.data.topic_id}`,
        status: 'published'
      };
    } catch (err: any) {
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
    if (process.env.SIMULATION_MODE === 'true') {
      return {
        status: 'published',
        live_url: `https://forum.example.com/t/topic/${platformPostId}`
      };
    }

    const baseUrl = connection.base_url;
    try {
      const res = await axios.get(`${baseUrl}/posts/${platformPostId}.json`, {
        headers: {
          'Api-Key': connection.api_key || '',
          'Api-Username': connection.username || 'system'
        }
      });
      return {
        status: res.data.deleted_at ? 'removed' : 'published',
        live_url: `${baseUrl}/t/topic/${res.data.topic_id}`
      };
    } catch (err: any) {
      const status = err.response?.status;
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

    const baseUrl = connection.base_url;
    try {
      await axios.delete(`${baseUrl}/posts/${platformPostId}.json`, {
        headers: {
          'Api-Key': connection.api_key || '',
          'Api-Username': connection.username || 'system'
        }
      });
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
      return { views: 142, likes: 18, comments: 6, shares: 2, clicks: 12 };
    }
    return { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
  }
}
