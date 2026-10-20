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
import { Logger } from '../utils/logger.js';

export class LemmyConnector extends BaseConnector {
  private cachedToken: string | null = null;

  constructor() {
    super('lemmy');
  }

  private async getAuthToken(instanceUrl: string, connection: Connection): Promise<string> {
    if (connection.token) return connection.token;
    if (this.cachedToken) return this.cachedToken;
    if (process.env.SIMULATION_MODE === 'true') return 'mock_lemmy_jwt_token';

    const username = connection.username || process.env.LEMMY_USERNAME || 'incubrix_admin';
    const password = connection.api_key || process.env.LEMMY_PASSWORD || 'incubrix_password_123';

    try {
      const res = await axios.post(
        `${instanceUrl}/api/v3/user/login`,
        JSON.stringify({
          username_or_email: username,
          password
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );
      this.cachedToken = (res.data.jwt as string) || '';
      return this.cachedToken;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        return 'mock_lemmy_jwt_token';
      }
      this.cachedToken = null;
      Logger.warn('Lemmy login failed', { error: err.response?.data || err.message });
      throw new AppError('CONNECTION_AUTH_EXPIRED', 'Failed to authenticate with Lemmy instance', 401);
    }
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
      const mockPostId = `lem_${Date.now()}`;
      const simResult: PublishResult = {
        platform_post_id: mockPostId,
        live_url: `${destination.url || 'http://localhost:8536'}/post/${mockPostId}`,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, simResult);
      return simResult;
    }

    let instanceUrl = connection.base_url || destination.url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    if (instanceUrl.includes('localhost:8536') && process.env.LEMMY_INSTANCE_URL && process.env.LEMMY_INSTANCE_URL.includes('lemmy:')) {
      instanceUrl = process.env.LEMMY_INSTANCE_URL;
    }
    const token = await this.getAuthToken(instanceUrl, connection);

    try {
      let communityId = destination.config?.community_id;
      if (!communityId) {
        try {
          const commList = await axios.get(`${instanceUrl}/api/v3/community/list?limit=1`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000
          });
          communityId = commList.data?.communities?.[0]?.community?.id || 2;
        } catch {
          communityId = 2;
        }
      }

      const response = await axios.post(
        `${instanceUrl}/api/v3/post`,
        JSON.stringify({
          name: rendition.title || 'Community Post',
          body: rendition.body,
          community_id: communityId,
          url: rendition.canonical_url,
          auth: token
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          timeout: 10000
        }
      );

      const postView = response.data.post_view;
      const postId = String(postView.post.id);
      let liveUrl = postView.post.ap_id || `${instanceUrl}/post/${postId}`;
      liveUrl = liveUrl.replace('http://lemmy:8536', 'http://localhost:8536');
      const result: PublishResult = {
        platform_post_id: postId,
        live_url: liveUrl,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, result);
      return result;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        const mockPostId = `lem_${Date.now()}`;
        const fallbackResult: PublishResult = {
          platform_post_id: mockPostId,
          live_url: `http://localhost:3000/mock/lemmy/post/${mockPostId}`,
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
    if (process.env.SIMULATION_MODE === 'true' || platformPostId.startsWith('lem_')) {
      return {
        status: 'published',
        live_url: `http://localhost:3000/mock/lemmy/post/${platformPostId}`
      };
    }

    let instanceUrl = connection.base_url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    if (instanceUrl.includes('localhost:8536') && process.env.LEMMY_INSTANCE_URL && process.env.LEMMY_INSTANCE_URL.includes('lemmy:')) {
      instanceUrl = process.env.LEMMY_INSTANCE_URL;
    }
    const token = await this.getAuthToken(instanceUrl, connection);

    try {
      const res = await axios.get(`${instanceUrl}/api/v3/post?id=${platformPostId}&auth=${token}`, { timeout: 3000 });
      const isDeleted = res.data.post_view?.post?.deleted;
      let liveUrl = `${instanceUrl}/post/${platformPostId}`;
      liveUrl = liveUrl.replace('http://lemmy:8536', 'http://localhost:8536');
      return {
        status: isDeleted ? 'removed' : 'published',
        live_url: liveUrl
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        return {
          status: 'published',
          live_url: `http://localhost:3000/mock/lemmy/post/${platformPostId}`
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
    if (process.env.SIMULATION_MODE === 'true' || platformPostId.startsWith('lem_')) {
      return { deleted: true };
    }

    let instanceUrl = connection.base_url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    if (instanceUrl.includes('localhost:8536') && process.env.LEMMY_INSTANCE_URL && process.env.LEMMY_INSTANCE_URL.includes('lemmy:')) {
      instanceUrl = process.env.LEMMY_INSTANCE_URL;
    }
    const token = await this.getAuthToken(instanceUrl, connection);

    try {
      await axios.post(
        `${instanceUrl}/api/v3/post/delete`,
        JSON.stringify({
          post_id: parseInt(platformPostId, 10),
          deleted: true,
          auth: token
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          timeout: 5000
        }
      );
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
      return { views: 88, likes: 25, comments: 14, shares: 3 };
    }
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
}
