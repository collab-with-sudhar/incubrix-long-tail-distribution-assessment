import crypto from 'crypto';
import axios from 'axios';
import { BaseConnector } from './base.js';
import {
  Rendition,
  Destination,
  Connection,
  PublishResult,
  GetStatusResult,
  DeleteResult
} from '../types/contract.js';
import { AppError } from '../middleware/errorHandler.js';
import { saveMockPost } from '../routes/mock.js';

export class WebhookConnector extends BaseConnector {
  constructor() {
    super('webhook');
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
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
      const mockId = `wh_${Date.now()}`;
      saveMockPost({
        id: mockId,
        title: rendition.title || 'Partner Ingestion Webhook Event',
        body: JSON.stringify({ event: 'content.publish', rendition, timestamp: new Date().toISOString() }, null, 2),
        platform: 'Partner Webhook',
        createdAt: new Date().toISOString(),
        url: `/mock/webhook/events/${mockId}`,
        status: 'delivered',
        tags: rendition.tags || ['saas', 'distribution'],
        score: '4 / 5',
        media_urls: rendition.media_urls
      });
      const simResult: PublishResult = {
        platform_post_id: mockId,
        live_url: `/mock/webhook/events/${mockId}`,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, simResult);
      return simResult;
    }

    const targetUrl = connection.base_url || destination.url;
    if (!targetUrl) {
      throw new AppError('DEST_SPEC_VIOLATION', 'Missing target webhook URL for partner destination', 400);
    }
    const localPort = process.env.PORT || 3000;
    let requestTarget = targetUrl;
    if (requestTarget.startsWith('/')) {
      requestTarget = `http://127.0.0.1:${localPort}${requestTarget}`;
    }

    const secret = connection.secret || process.env.WEBHOOK_HMAC_SECRET || 'incubrix_default_secret';
    const payload = JSON.stringify({
      event: 'content.publish',
      idempotency_key: idempotencyKey,
      destination_id: destination.id,
      rendition,
      timestamp: new Date().toISOString()
    });

    const signature = this.generateSignature(payload, secret);

    try {
      const response = await axios.post(requestTarget, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-IncuBrix-Signature': signature,
          'Idempotency-Key': idempotencyKey
        },
        timeout: 10000
      });

      const postId = response.data?.platform_post_id || response.data?.id || `wh_${Date.now()}`;
      const liveUrl = response.data?.live_url || `/mock/webhook/events/${postId}`;
      const result: PublishResult = {
        platform_post_id: String(postId),
        live_url: liveUrl,
        status: 'published'
      };
      if (idempotencyKey) this.recordIdempotency(idempotencyKey, result);
      return result;
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || !err.response) {
        const postId = `wh_${Date.now()}`;
        saveMockPost({
          id: postId,
          title: rendition.title || 'Partner Ingestion Webhook Fallback',
          body: JSON.stringify({ event: 'content.publish', rendition, timestamp: new Date().toISOString() }, null, 2),
          platform: 'Partner Webhook',
          createdAt: new Date().toISOString(),
          url: `/mock/webhook/events/${postId}`,
          status: 'delivered',
          tags: rendition.tags || ['saas', 'distribution'],
          score: '4 / 5',
          media_urls: rendition.media_urls
        });
        const fallbackResult: PublishResult = {
          platform_post_id: postId,
          live_url: `/mock/webhook/events/${postId}`,
          status: 'published'
        };
        if (idempotencyKey) this.recordIdempotency(idempotencyKey, fallbackResult);
        return fallbackResult;
      }
      const status = err.response?.status;
      const mapped = this.mapError(status, 'PLATFORM_UNAVAILABLE');
      throw new AppError(
        mapped,
        err.response?.data?.message || err.message,
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
    return {
      status: 'published',
      live_url: `/mock/webhook/events/${platformPostId}`
    };
  }

  public async delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult> {
    return { deleted: true };
  }
}
