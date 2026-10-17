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

export class LemmyConnector extends BaseConnector {
  constructor() {
    super('lemmy');
  }

  private async getAuthToken(instanceUrl: string, connection: Connection): Promise<string> {
    if (connection.token) return connection.token;
    if (process.env.SIMULATION_MODE === 'true') return 'mock_lemmy_jwt_token';

    const username = connection.username || process.env.LEMMY_USERNAME || 'incubrix_bot';
    const password = connection.api_key || process.env.LEMMY_PASSWORD || '';

    try {
      const res = await axios.post(`${instanceUrl}/api/v3/user/login`, {
        username_or_email: username,
        password
      });
      return res.data.jwt || '';
    } catch (err: any) {
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Failed to authenticate with Lemmy instance', 401);
    }
  }

  public async publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<PublishResult> {
    if (process.env.SIMULATION_MODE === 'true') {
      const mockPostId = `lem_${Date.now()}`;
      return {
        platform_post_id: mockPostId,
        live_url: `${destination.url || 'http://localhost:8536'}/post/${mockPostId}`,
        status: 'published'
      };
    }

    const instanceUrl = connection.base_url || destination.url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    const token = await this.getAuthToken(instanceUrl, connection);

    try {
      const communityId = destination.config?.community_id || 1;
      const response = await axios.post(
        `${instanceUrl}/api/v3/post`,
        {
          name: rendition.title || 'Community Post',
          body: rendition.body,
          community_id: communityId,
          url: rendition.canonical_url,
          auth: token
        },
        { timeout: 10000 }
      );

      const postView = response.data.post_view;
      const postId = String(postView.post.id);
      return {
        platform_post_id: postId,
        live_url: `${instanceUrl}/post/${postId}`,
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
        live_url: `http://localhost:8536/post/${platformPostId}`
      };
    }

    const instanceUrl = connection.base_url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    const token = await this.getAuthToken(instanceUrl, connection);

    try {
      const res = await axios.get(`${instanceUrl}/api/v3/post?id=${platformPostId}&auth=${token}`);
      const isDeleted = res.data.post_view?.post?.deleted;
      return {
        status: isDeleted ? 'removed' : 'published',
        live_url: `${instanceUrl}/post/${platformPostId}`
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

    const instanceUrl = connection.base_url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    const token = await this.getAuthToken(instanceUrl, connection);

    try {
      await axios.post(`${instanceUrl}/api/v3/post/delete`, {
        post_id: parseInt(platformPostId, 10),
        deleted: true,
        auth: token
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
      return { views: 88, likes: 25, comments: 14, shares: 3 };
    }
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
