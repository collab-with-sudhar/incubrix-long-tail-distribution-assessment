// IncuBrix Appendix A: Connector Contract & Destination Schema

export type ConnectorTier = 'native' | 'protocol' | 'bridge' | 'feed' | 'assisted';
export type ConnectorAuthType = 'oauth2' | 'api_key' | 'bot_token' | 'none';

export type SharedErrorCode =
  | 'DEST_SPEC_VIOLATION'
  | 'DEST_RULE_FREQUENCY_CAP'
  | 'CONNECTION_AUTH_EXPIRED'
  | 'PLATFORM_RATE_LIMIT'
  | 'PLATFORM_QUOTA_EXHAUSTED'
  | 'PLATFORM_CONTENT_REJECTED'
  | 'PLATFORM_UNAVAILABLE'
  | 'CONNECTOR_DISABLED';

export interface Rendition {
  title?: string;
  body: string;
  canonical_url?: string;
  media_urls?: string[];
  tags?: string[];
  is_ai_generated?: boolean;
  is_promotional?: boolean;
  metadata?: Record<string, any>;
}

export interface Destination {
  id?: string;
  name: string;
  url: string;
  platform_key: string;
  surface: string;
  category?: string;
  audience_tags?: string[];
  language?: string;
  geo?: string;
  est_audience?: number;
  rules_url?: string;
  frequency_cap?: string; // e.g. "1/day", "1/week"
  self_promo_allowed?: boolean;
  link_policy?: 'allowed' | 'no_links' | 'first_comment' | 'domain_whitelist';
  disclosure_required?: boolean;
  automation_allowed?: boolean;
  connector_key: string;
  relevance_score?: number; // 1-5
  relevance_reason?: string;
  level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  last_certified_at?: string;
  config?: Record<string, any>;
}

export interface Connection {
  api_key?: string;
  token?: string;
  base_url?: string;
  username?: string;
  secret?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

export interface Violation {
  field: string;
  code: SharedErrorCode | string;
  message: string;
}

export interface ValidateResult {
  ok: boolean;
  violations: Violation[];
}

export interface PublishResult {
  platform_post_id: string;
  live_url: string;
  status: 'published' | 'queued' | 'pending';
  warnings?: string[];
}

export interface GetStatusResult {
  status: 'published' | 'pending' | 'removed' | 'failed';
  live_url?: string;
}

export interface DeleteResult {
  deleted: boolean;
}

export interface FetchMetricsResult {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  watch_time_s?: number;
  clicks?: number;
}

export interface RefreshAuthResult {
  expires_at: string;
}

export interface AssistPackItem {
  name: string;
  url: string;
  type: string;
}

export interface AssistPackResult {
  files: AssistPackItem[];
  caption: string;
  deep_link: string;
  checklist: string[];
}

export interface ConnectorManifestSurface {
  key: string;
  content_types: string[];
  spec: {
    title_max_chars?: number;
    body_max_chars?: number;
    links_allowed?: boolean;
    media_max_count?: number;
    supported_media_types?: string[];
  };
}

export interface ConnectorManifest {
  key: string;
  version: string;
  tier: ConnectorTier;
  auth: ConnectorAuthType;
  surfaces: ConnectorManifestSurface[];
  rate_limits: {
    per_connection?: {
      requests: number;
      per_seconds: number;
    };
  };
  capabilities: ('publish' | 'status' | 'delete' | 'metrics' | 'refresh_auth' | 'assist_pack')[];
  error_map: Record<string, SharedErrorCode>;
  instance_param?: string;
}

export interface IncuBrixErrorResponse {
  error: {
    code: SharedErrorCode | string;
    message: string;
    retryable: boolean;
    details?: any;
  };
}
