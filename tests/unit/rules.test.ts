import { RulesEngine } from '../../src/rules/engine.js';
import { Rendition, Destination } from '../../src/types/contract.js';

describe('Must-Have 4: Posting Rules Engine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
  });

  const baseDest: Destination = {
    name: 'Tech Forum',
    url: 'https://forum.example.com',
    platform_key: 'discourse',
    surface: 'topic',
    connector_key: 'discourse',
    frequency_cap: '1/week',
    self_promo_allowed: false,
    link_policy: 'allowed',
    disclosure_required: true
  };

  test('blocks promotional posts to communities with self_promo_allowed = false', () => {
    const promoRendition: Rendition = {
      title: 'Buy our new SaaS software',
      body: 'Check out our amazing deal and pricing!',
      is_promotional: true
    };

    const res = engine.evaluate(promoRendition, baseDest);
    expect(res.allowed).toBe(false);
    expect(res.action).toBe('block');
    expect(res.violations[0].code).toBe('PLATFORM_CONTENT_REJECTED');
  });

  test('blocks or auto-appends AI disclosure when disclosure_required = true', () => {
    const aiRendition: Rendition = {
      title: 'AI Insights 2026',
      body: 'Here is an overview of autonomous agent systems.',
      is_ai_generated: true
    };

    const res = engine.evaluate(aiRendition, baseDest);
    expect(res.allowed).toBe(true);
    expect(res.transformedRendition?.body).toContain('AI assistance');
    expect(res.warnings).toBeDefined();
  });

  test('enforces frequency cap and triggers reschedule on second post within window', () => {
    const standardRendition: Rendition = {
      title: 'First community update',
      body: 'Excited to be participating in this discussion forum.'
    };

    // First post: Allowed
    const firstCheck = engine.evaluate(standardRendition, baseDest);
    expect(firstCheck.allowed).toBe(true);
    engine.recordPost(baseDest.url);

    // Second post immediately after: Must be blocked / rescheduled
    const secondCheck = engine.evaluate(standardRendition, baseDest);
    expect(secondCheck.allowed).toBe(false);
    expect(secondCheck.action).toBe('reschedule');
    expect(secondCheck.violations[0].code).toBe('DEST_RULE_FREQUENCY_CAP');
    expect(secondCheck.reschedule_after_seconds).toBeGreaterThan(0);
  });

  test('enforces strict no_links policy', () => {
    const strictLinkDest: Destination = {
      ...baseDest,
      link_policy: 'no_links'
    };

    const postWithLink: Rendition = {
      body: 'Read our full announcement at https://incubrix.com/news today!'
    };

    const res = engine.evaluate(postWithLink, strictLinkDest);
    expect(res.allowed).toBe(false);
    expect(res.action).toBe('block');
    expect(res.violations[0].code).toBe('DEST_SPEC_VIOLATION');
  });
});
