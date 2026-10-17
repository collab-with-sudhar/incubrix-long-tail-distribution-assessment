import { globalRegistry } from '../../src/connectors/registry.js';
import { Rendition, Destination } from '../../src/types/contract.js';

describe('Appendix A: Connector Contract Test Suite', () => {
  const sampleRendition: Rendition = {
    title: 'Testing Connector Contract Spec',
    body: 'Sample body text for IncuBrix connector certification.',
    canonical_url: 'https://example.com/blog/test',
    tags: ['test', 'incubrix']
  };

  const connectors = ['discourse', 'lemmy', 'devto', 'ghost', 'webhook'];

  test('All 6 Core Connectors are registered', () => {
    const list = globalRegistry.list();
    expect(list).toContain('discourse');
    expect(list).toContain('lemmy');
    expect(list).toContain('devto');
    expect(list).toContain('ghost');
    expect(list).toContain('webhook');
    expect(list).toContain('assisted');
  });

  for (const key of connectors) {
    describe(`Connector: ${key}`, () => {
      const connector = globalRegistry.get(key);
      const testDest: Destination = {
        name: `Test ${key}`,
        url: 'http://localhost:3000/mock',
        platform_key: key,
        surface: connector.manifest.surfaces[0].key,
        connector_key: key
      };

      test('validates surface specifications correctly', async () => {
        const result = await connector.validate(sampleRendition, testDest, {});
        expect(result.ok).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      test('catches specification violations', async () => {
        const badRendition: Rendition =
          key === 'webhook'
            ? { ...sampleRendition, body: 'A'.repeat(1500000) } // Exceeds webhook body max chars
            : { ...sampleRendition, title: 'A'.repeat(500) }; // Exceeds title limit

        const result = await connector.validate(badRendition, testDest, {});
        expect(result.ok).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations[0].code).toBe('DEST_SPEC_VIOLATION');
      });

      test('publishes successfully in simulation mode', async () => {
        const pub = await connector.publish(sampleRendition, testDest, {}, `test_idemp_${key}`);
        expect(pub.platform_post_id).toBeDefined();
        expect(pub.live_url).toBeDefined();
        expect(pub.status).toBe('published');
      });

      test('retrieves post status', async () => {
        const pub = await connector.publish(sampleRendition, testDest, {}, `test_idemp_${key}_2`);
        const status = await connector.getStatus(pub.platform_post_id, {});
        expect(status.status).toBe('published');
      });

      test('deletes post and confirms cleanup', async () => {
        const pub = await connector.publish(sampleRendition, testDest, {}, `test_idemp_${key}_3`);
        const del = await connector.delete(pub.platform_post_id, {});
        expect(del.deleted).toBe(true);
      });
    });
  }

  describe('Assisted Connector (Assisted Tier)', () => {
    const assisted = globalRegistry.get('assisted');
    const assistedDest: Destination = {
      name: 'Assisted Forum',
      url: 'https://example.com/submit',
      platform_key: 'assisted',
      surface: 'manual_pack',
      connector_key: 'assisted',
      self_promo_allowed: false,
      disclosure_required: true,
      link_policy: 'first_comment'
    };

    test('generates assist pack with caption, deep_link and checklist', async () => {
      const pack = await assisted.buildAssistPack(sampleRendition, assistedDest);
      expect(pack.caption).toContain(sampleRendition.title);
      expect(pack.deep_link).toBe(assistedDest.url);
      expect(pack.checklist.length).toBeGreaterThanOrEqual(3);
    });
  });
});
