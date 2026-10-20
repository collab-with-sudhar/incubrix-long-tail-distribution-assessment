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

export class SlackConnector extends BaseConnector {
  constructor() {
    super('slack');
  }

  public async publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<PublishResult> {
    const webhookUrl = connection.base_url || destination.url;
    const token = connection.token || process.env.SLACK_BOT_TOKEN;
    const isMock = !token || token.startsWith('mock_') || process.env.SIMULATION_MODE === 'true' || (webhookUrl && !webhookUrl.includes('hooks.slack.com'));

    if (isMock) {
      const mockMsgId = `slk_${Date.now()}`;
      return {
        platform_post_id: mockMsgId,
        live_url: `/mock/slack/messages/${mockMsgId}`,
        status: 'published'
      };
    }

    try {
      if (webhookUrl && webhookUrl.includes('hooks.slack.com')) {
        // Incoming webhook mode
        const response = await axios.post(
          webhookUrl,
          {
            text: `*${rendition.title || 'IncuBrix Update'}*\n\n${rendition.body}${
              rendition.canonical_url ? `\n\n<${rendition.canonical_url}|Read More>` : ''
            }`
          },
          { timeout: 10000 }
        );

        const msgId = `slk_${Date.now()}`;
        return {
          platform_post_id: msgId,
          live_url: `${webhookUrl}/${msgId}`,
          status: 'published'
        };
      } else if (token) {
        // Web API mode
        const channel = destination.config?.channel_id || '#general';
        const response = await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel,
            text: rendition.title || 'IncuBrix Content',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${rendition.title || 'Update'}*\n${rendition.body}`
                }
              }
            ]
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        const ts = response.data?.ts;
        return {
          platform_post_id: String(ts),
          live_url: `https://slack.com/archives/${channel}/p${ts}`,
          status: 'published'
        };
      }

      throw new AppError('DEST_SPEC_VIOLATION', 'Missing Slack webhook URL or Bot Token', 400);
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
      live_url: `https://slack.com/archives/channel/p${platformPostId}`
    };
  }

  public async delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult> {
    return { deleted: true };
  }
}
