import { BaseConnector } from './base.js';
import { DiscourseConnector } from './discourse.js';
import { LemmyConnector } from './lemmy.js';
import { DevtoConnector } from './devto.js';
import { GhostConnector } from './ghost.js';
import { WebhookConnector } from './webhook.js';
import { AssistedConnector } from './assisted.js';
import { HashnodeConnector } from './hashnode.js';
import { SlackConnector } from './slack.js';
import { MRSSConnector } from './mrss.js';
import { AppError } from '../middleware/errorHandler.js';

export class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();
  private disabledConnectors: Set<string> = new Set();

  constructor() {
    this.register(new DiscourseConnector());
    this.register(new LemmyConnector());
    this.register(new DevtoConnector());
    this.register(new GhostConnector());
    this.register(new WebhookConnector());
    this.register(new AssistedConnector());
    this.register(new HashnodeConnector());
    this.register(new SlackConnector());
    this.register(new MRSSConnector());
  }

  public register(connector: BaseConnector): void {
    this.connectors.set(connector.connectorKey, connector);
  }

  public disableConnector(key: string): void {
    this.disabledConnectors.add(key);
  }

  public enableConnector(key: string): void {
    this.disabledConnectors.delete(key);
  }

  public get(key: string): BaseConnector {
    if (this.disabledConnectors.has(key)) {
      throw new AppError('CONNECTOR_DISABLED', `Connector ${key} is currently disabled by system kill switch`, 503);
    }

    const connector = this.connectors.get(key);
    if (!connector) {
      throw new AppError('DEST_SPEC_VIOLATION', `No connector found for key: ${key}`, 404);
    }
    return connector;
  }

  public list(): string[] {
    return Array.from(this.connectors.keys());
  }
}

export const globalRegistry = new ConnectorRegistry();
