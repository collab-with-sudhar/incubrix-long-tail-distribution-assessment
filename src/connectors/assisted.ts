import { BaseConnector } from './base.js';
import {
  Rendition,
  Destination,
  Connection,
  PublishResult,
  GetStatusResult,
  DeleteResult,
  AssistPackResult
} from '../types/contract.js';

export class AssistedConnector extends BaseConnector {
  constructor() {
    super('assisted');
  }

  public async buildAssistPack(
    rendition: Rendition,
    destination: Destination
  ): Promise<AssistPackResult> {
    const files = (rendition.media_urls || []).map((url, idx) => ({
      name: `asset_${idx + 1}.${url.split('.').pop() || 'png'}`,
      url,
      type: 'image'
    }));

    const caption = `${rendition.title ? `${rendition.title}\n\n` : ''}${rendition.body}${
      rendition.canonical_url ? `\n\nSource: ${rendition.canonical_url}` : ''
    }`;

    const checklist = [
      `Confirm destination is ${destination.name}`,
      destination.self_promo_allowed === false
        ? '⚠️ Community strictly disallows self-promotion — ensure discussion framing only'
        : 'Verify self-promotion rules are respected',
      destination.disclosure_required
        ? '⚠️ AI content disclosure is required: ensure note is attached'
        : 'AI disclosure not strictly enforced',
      destination.link_policy === 'first_comment'
        ? 'Place link in first comment only, NOT in initial post'
        : 'Links permitted according to destination link policy',
      'Review formatting and submit manually'
    ];

    const deepLink = destination.url || 'http://localhost:3000/mock/assisted/submit';

    return {
      files,
      caption,
      deep_link: deepLink,
      checklist
    };
  }

  public async publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<PublishResult> {
    const pack = await this.buildAssistPack(rendition, destination);
    const packId = `assist_${Date.now()}`;
    return {
      platform_post_id: packId,
      live_url: pack.deep_link,
      status: 'pending',
      warnings: ['Assisted connector: Content pack prepared for manual human submission']
    };
  }

  public async getStatus(
    platformPostId: string,
    connection: Connection
  ): Promise<GetStatusResult> {
    return {
      status: 'pending',
      live_url: `http://localhost:3000/mock/assisted/submit?id=${platformPostId}`
    };
  }

  public async delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult> {
    return { deleted: true };
  }
}
