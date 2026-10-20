import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  ConnectorManifest,
  Rendition,
  Destination,
  Connection,
  ValidateResult,
  PublishResult,
  GetStatusResult,
  DeleteResult,
  FetchMetricsResult,
  RefreshAuthResult,
  AssistPackResult,
  Violation,
  SharedErrorCode
} from '../types/contract.js';

export abstract class BaseConnector {
  public manifest: ConnectorManifest;
  public connectorKey: string;
  protected idempCache: Map<string, { result: PublishResult; timestamp: number }> = new Map();

  constructor(connectorKey: string) {
    this.connectorKey = connectorKey;
    this.manifest = this.loadManifest(connectorKey);
  }

  protected checkIdempotency(key: string): PublishResult | undefined {
    if (!key) return undefined;
    const item = this.idempCache.get(key);
    if (!item) return undefined;
    if (Date.now() - item.timestamp > 10 * 60 * 1000) {
      this.idempCache.delete(key);
      return undefined;
    }
    return item.result;
  }

  protected recordIdempotency(key: string, result: PublishResult): void {
    if (!key || !result) return;
    this.idempCache.set(key, { result, timestamp: Date.now() });
  }

  private loadManifest(key: string): ConnectorManifest {
    let manifestPath = path.resolve(process.cwd(), 'src', 'manifests', `${key}.yaml`);
    if (!fs.existsSync(manifestPath)) {
      manifestPath = path.resolve(process.cwd(), 'dist', 'manifests', `${key}.yaml`);
    }
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found for connector: ${key} at ${manifestPath}`);
    }
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return yaml.load(raw) as ConnectorManifest;
  }

  /**
   * Validate surface constraints according to manifest specification
   */
  public async validate(
    rendition: Rendition,
    destination: Destination,
    connection: Connection
  ): Promise<ValidateResult> {
    const violations: Violation[] = [];
    const surfaceKey = destination.surface;
    const surface = this.manifest.surfaces.find((s) => s.key === surfaceKey) || this.manifest.surfaces[0];

    if (!surface) {
      violations.push({
        field: 'surface',
        code: 'DEST_SPEC_VIOLATION',
        message: `Unknown surface ${surfaceKey} for connector ${this.connectorKey}`
      });
      return { ok: false, violations };
    }

    const spec = surface.spec;

    if (spec.title_max_chars && rendition.title && rendition.title.length > spec.title_max_chars) {
      violations.push({
        field: 'title',
        code: 'DEST_SPEC_VIOLATION',
        message: `Title exceeds maximum allowed length of ${spec.title_max_chars} characters (received ${rendition.title.length})`
      });
    }

    if (spec.body_max_chars && rendition.body && rendition.body.length > spec.body_max_chars) {
      violations.push({
        field: 'body',
        code: 'DEST_SPEC_VIOLATION',
        message: `Body exceeds maximum allowed length of ${spec.body_max_chars} characters (received ${rendition.body.length})`
      });
    }

    if (spec.links_allowed === false && (rendition.body.includes('http://') || rendition.body.includes('https://'))) {
      violations.push({
        field: 'body',
        code: 'DEST_SPEC_VIOLATION',
        message: `Destination does not permit outbound links in the body`
      });
    }

    if (spec.media_max_count !== undefined && rendition.media_urls && rendition.media_urls.length > spec.media_max_count) {
      violations.push({
        field: 'media_urls',
        code: 'DEST_SPEC_VIOLATION',
        message: `Attached media count (${rendition.media_urls.length}) exceeds maximum permitted (${spec.media_max_count})`
      });
    }

    return {
      ok: violations.length === 0,
      violations
    };
  }

  public abstract publish(
    rendition: Rendition,
    destination: Destination,
    connection: Connection,
    idempotencyKey: string
  ): Promise<PublishResult>;

  public abstract getStatus(
    platformPostId: string,
    connection: Connection
  ): Promise<GetStatusResult>;

  public abstract delete(
    platformPostId: string,
    connection: Connection
  ): Promise<DeleteResult>;

  public async fetchMetrics(
    platformPostId: string,
    connection: Connection,
    since?: string
  ): Promise<FetchMetricsResult> {
    return { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
  }

  public async refreshAuth(
    connection: Connection
  ): Promise<RefreshAuthResult> {
    return { expires_at: new Date(Date.now() + 86400000).toISOString() };
  }

  public async buildAssistPack(
    rendition: Rendition,
    destination: Destination
  ): Promise<AssistPackResult> {
    throw new Error(`buildAssistPack is only supported by assisted tier connectors`);
  }

  /**
   * Translates HTTP status or error codes into shared IncuBrix error codes
   */
  public mapError(statusOrCode: number | string, defaultCode: SharedErrorCode = 'PLATFORM_UNAVAILABLE'): SharedErrorCode {
    const key = String(statusOrCode);
    return this.manifest.error_map[key] || defaultCode;
  }
}
