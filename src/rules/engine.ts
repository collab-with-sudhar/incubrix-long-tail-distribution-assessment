import { Rendition, Destination, Violation } from '../types/contract.js';

export interface RuleCheckResult {
  allowed: boolean;
  action: 'proceed' | 'block' | 'reschedule';
  reschedule_after_seconds?: number;
  violations: Violation[];
  warnings?: string[];
  transformedRendition?: Rendition;
}

export class RulesEngine {
  // Store destination post history in-memory (or persistence) for frequency cap tracking
  private postHistory: Map<string, number[]> = new Map();

  /**
   * Record a successful post to track frequency caps
   */
  public recordPost(destinationIdOrUrl: string, timestamp: number = Date.now()): void {
    const list = this.postHistory.get(destinationIdOrUrl) || [];
    list.push(timestamp);
    this.postHistory.set(destinationIdOrUrl, list);
  }

  /**
   * Reset history (useful for testing)
   */
  public clearHistory(): void {
    this.postHistory.clear();
  }

  /**
   * Evaluate all posting rules for a rendition against a target destination
   */
  public evaluate(rendition: Rendition, destination: Destination): RuleCheckResult {
    const violations: Violation[] = [];
    const warnings: string[] = [];
    let action: 'proceed' | 'block' | 'reschedule' = 'proceed';
    let rescheduleSeconds: number | undefined;
    let transformed: Rendition = { ...rendition };

    const destinationKey = destination.id || destination.url || destination.name;

    // 1. Self-Promotion Policy
    if (destination.self_promo_allowed === false && rendition.is_promotional) {
      violations.push({
        field: 'is_promotional',
        code: 'PLATFORM_CONTENT_REJECTED',
        message: `Self-promotion is strictly prohibited in ${destination.name}`
      });
      action = 'block';
    }

    // 2. Link Policy
    if (destination.link_policy === 'no_links') {
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (rendition.body && linkRegex.test(rendition.body)) {
        violations.push({
          field: 'body',
          code: 'DEST_SPEC_VIOLATION',
          message: `Destination policy forbids external links in the content body`
        });
        action = 'block';
      }
    } else if (destination.link_policy === 'first_comment') {
      // If links are only allowed in first comment, extract or warn
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (rendition.body && linkRegex.test(rendition.body)) {
        warnings.push('Outbound links detected; should be moved to first comment per destination policy');
      }
    }

    // 3. AI-Content Disclosure Policy
    if (destination.disclosure_required && rendition.is_ai_generated) {
      const lowerBody = (rendition.body || '').toLowerCase();
      const hasDisclosure =
        lowerBody.includes('ai-generated') ||
        lowerBody.includes('ai generated') ||
        lowerBody.includes('generated with ai') ||
        lowerBody.includes('created with ai');

      if (!hasDisclosure) {
        // Auto-append disclosure or fail with policy violation
        transformed.body = `${rendition.body}\n\n*(Note: This content was generated with AI assistance in accordance with community guidelines.)*`;
        warnings.push('AI disclosure statement automatically appended to satisfy destination policy');
      }
    }

    // 4. Frequency Cap Rule
    if (destination.frequency_cap) {
      const capCheck = this.checkFrequencyCap(destinationKey, destination.frequency_cap);
      if (!capCheck.allowed) {
        violations.push({
          field: 'frequency_cap',
          code: 'DEST_RULE_FREQUENCY_CAP',
          message: `Posting limit exceeded. Frequency cap: ${destination.frequency_cap}. Next allowed window in ${capCheck.retryAfterSeconds}s`
        });
        action = 'reschedule';
        rescheduleSeconds = capCheck.retryAfterSeconds;
      }
    }

    return {
      allowed: violations.length === 0,
      action: violations.length > 0 ? action : 'proceed',
      reschedule_after_seconds: rescheduleSeconds,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined,
      transformedRendition: transformed
    };
  }

  /**
   * Parse cap format (e.g. "1/day", "2/day", "1/week", "5/hour") and verify against history
   */
  private checkFrequencyCap(
    destKey: string,
    capStr: string
  ): { allowed: boolean; retryAfterSeconds?: number } {
    const parts = capStr.split('/');
    if (parts.length !== 2) {
      return { allowed: true };
    }

    const maxPosts = parseInt(parts[0], 10) || 1;
    const unit = parts[1].toLowerCase().trim();

    let windowMs = 24 * 60 * 60 * 1000; // default 1 day
    if (unit.startsWith('min')) windowMs = 60 * 1000;
    else if (unit.startsWith('hour')) windowMs = 60 * 60 * 1000;
    else if (unit.startsWith('day')) windowMs = 24 * 60 * 60 * 1000;
    else if (unit.startsWith('week')) windowMs = 7 * 24 * 60 * 60 * 1000;
    else if (unit.startsWith('month')) windowMs = 30 * 24 * 60 * 60 * 1000;

    const now = Date.now();
    const history = this.postHistory.get(destKey) || [];
    const validHistory = history.filter((ts) => now - ts < windowMs);

    if (validHistory.length >= maxPosts) {
      const oldestInWindow = Math.min(...validHistory);
      const retryAfterSeconds = Math.ceil((oldestInWindow + windowMs - now) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfterSeconds)
      };
    }

    return { allowed: true };
  }
}
