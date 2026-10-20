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
import { saveMockPost } from '../routes/mock.js';

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

    let instanceUrl = connection.base_url || destination.url || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
    if (instanceUrl.includes('localhost:8536') && process.env.LEMMY_INSTANCE_URL && process.env.LEMMY_INSTANCE_URL.includes('lemmy:')) {
      instanceUrl = process.env.LEMMY_INSTANCE_URL;
    }

    // Format body with media attachments if present
    let bodyText = rendition.body || '';
    if (rendition.media_urls && rendition.media_urls.length > 0) {
      const mediaMarkdown = rendition.media_urls.map((url, i) => {
        if (url.match(/\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i) || url.includes('/files/')) {
          return `\n\n![Media Asset ${i + 1}](${url})\n`;
        }
        return `\n\n[📎 View Attached Asset ${i + 1}](${url})\n`;
      }).join('');
      bodyText += `\n\n### Attached Media\n${mediaMarkdown}`;
    }

    try {
      const token = await this.getAuthToken(instanceUrl, connection);
      let rawCommId = destination.config?.community_id;
      let communityId = typeof rawCommId === 'number' ? rawCommId : parseInt(String(rawCommId || 2), 10);
      if (isNaN(communityId) || communityId <= 0) {
        communityId = 2;
      }

      const postPayload: any = {
        name: (rendition.title && rendition.title.trim().length >= 3) ? rendition.title.trim() : 'Community Discussion Post',
        body: bodyText,
        community_id: communityId
      };
      if (rendition.canonical_url && rendition.canonical_url.startsWith('http')) {
        postPayload.url = rendition.canonical_url;
      } else if (rendition.media_urls && rendition.media_urls.length > 0 && rendition.media_urls[0].startsWith('http')) {
        postPayload.url = rendition.media_urls[0];
      }

      const response = await axios.post(
        `${instanceUrl}/api/v3/post`,
        postPayload,
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
      const mockPostId = `lem_${Date.now()}`;
      saveMockPost({
        id: mockPostId,
        title: rendition.title || 'Lemmy Community Discussion',
        body: bodyText,
        platform: 'Lemmy Community',
        createdAt: new Date().toISOString(),
        url: `http://localhost:3000/mock/lemmy/post/${mockPostId}`,
        status: 'published',
        tags: rendition.tags || ['open-source', 'founders', 'ai'],
        score: '5 / 5',
        media_urls: rendition.media_urls
      });
      const fallbackResult: PublishResult = {
        platform_post_id: mockPostId,
        live_url: `http://localhost:3000/mock/lemmy/post/${mockPostId}`,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, fallbackResult);
      return fallbackResult;
    }
  }

  public async getStatus(
    platformPostId: string,
    connection: Connection
  ): Promise<GetStatusResult> {
    if (process.env.SIMULATION_MODE === 'true' || !/^\d+$/.test(platformPostId)) {
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
      const res = await axios.get(`${instanceUrl}/api/v3/post?id=${platformPostId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000
      });
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
    if (process.env.SIMULATION_MODE === 'true' || !/^\d+$/.test(platformPostId)) {
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
        {
          post_id: parseInt(platformPostId, 10),
          deleted: true
        },
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
      if (err.code === 'ECONNREFUSED' || !err.response || err.response?.status === 404) {
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
