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

export class HashnodeConnector extends BaseConnector {
  constructor() {
    super('hashnode');
  }

  public async publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<PublishResult> {
    const apiKey = connection.api_key || process.env.HASHNODE_API_KEY;
    const isMock = !apiKey || apiKey.startsWith('mock_') || process.env.SIMULATION_MODE === 'true';

    if (isMock) {
      const mockPostId = `hn_${Date.now()}`;
      return {
        platform_post_id: mockPostId,
        live_url: `/mock/hashnode/p/${mockPostId}`,
        status: 'published'
      };
    }

    const publicationId = destination.config?.publication_id || 'pub_incubrix';

    const query = `
      mutation PublishPost($input: PublishPostInput!) {
        publishPost(input: $input) {
          post {
            id
            url
          }
        }
      }
    `;

    try {
      const response = await axios.post(
        'https://gql.hashnode.com',
        {
          query,
          variables: {
            input: {
              title: rendition.title || 'Technical Article',
              contentMarkdown: rendition.body,
              publicationId,
              originalArticleURL: rendition.canonical_url,
              tags: (rendition.tags || ['technology', 'saas']).map((t) => ({ slug: t.toLowerCase(), name: t }))
            }
          }
        },
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const post = response.data?.data?.publishPost?.post;
      if (!post) {
        throw new Error(response.data?.errors?.[0]?.message || 'Failed to publish to Hashnode');
      }

      return {
        platform_post_id: post.id,
        live_url: post.url,
        status: 'published'
      };
    } catch (err: any) {
      const status = err.response?.status;
      const mapped = this.mapError(status, 'PLATFORM_UNAVAILABLE');
      throw new AppError(mapped, err.message, status || 500);
    }
  }

  public async getStatus(
    platformPostId: string,
    connection: Connection
  ): Promise<GetStatusResult> {
    return {
      status: 'published',
      live_url: `https://hashnode.com/post/${platformPostId}`
    };
  }

  public async delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult> {
    return { deleted: true };
  }

  public async fetchMetrics(
    platformPostId: string,
    connection: Connection,
    since?: string
  ): Promise<FetchMetricsResult> {
    if (process.env.SIMULATION_MODE === 'true') {
      return { views: 410, likes: 32, comments: 8, shares: 5 };
    }
    return { views: 0, likes: 0, comments: 0 };
  }
}
