import { globalCatalogueImporter } from '../../src/catalogue/importer.js';
import { globalRulesCaptureService } from '../../src/rules/capture.js';
import { globalContentTailoringService } from '../../src/catalogue/tailoring.js';
import { globalRegistry } from '../../src/connectors/registry.js';
import { Destination, Rendition } from '../../src/types/contract.js';

describe('Advanced Level Specification Tests (15 Marks)', () => {
  describe('1. Catalogue CSV Import & 1,000 Row Benchmark', () => {
    test('normalizes URLs correctly (lowercase, trims, removes hashes and trailing slashes)', () => {
      const normalized = globalCatalogueImporter.normalizeUrl('  HTTPS://Discourse.Example.Com/Category/tech/#top/ ');
      expect(normalized).toBe('https://discourse.example.com/Category/tech');
    });

    test('validates, de-duplicates, enriches and reports errors row-by-row', async () => {
      const csv = `name,url,platform_key,connector_key,frequency_cap,self_promo_allowed
Forum A,https://forum-a.org,discourse,discourse,1/week,false
Forum A Duplicate,https://forum-a.org/,discourse,discourse,1/week,false
Invalid Missing URL,,lemmy,lemmy,1/day,true
Forum B,https://forum-b.org,discourse,discourse,2/day,true`;

      const result = await globalCatalogueImporter.importFromCsv(csv, false);
      expect(result.total_rows).toBe(4);
      expect(result.imported_count).toBe(2);
      expect(result.duplicates_count).toBe(1);
      expect(result.errors_count).toBe(1);
      expect(result.reports).toHaveLength(4);

      const dupReport = result.reports.find((r) => r.status === 'skipped_duplicate');
      expect(dupReport).toBeDefined();

      const errReport = result.reports.find((r) => r.status === 'validation_error');
      expect(errReport).toBeDefined();
    });

    test('Benchmark: 1,000 rows import in under 5 minutes (300,000ms)', async () => {
      // Generate 1,000 synthetic destination rows
      const header = 'name,url,platform_key,connector_key,category,audience_tags,frequency_cap,self_promo_allowed,link_policy,disclosure_required\n';
      const rows: string[] = [];
      for (let i = 1; i <= 1000; i++) {
        rows.push(`"Benchmark Dest #${i}","https://community-${i}.benchmark-test.com/c/tech","discourse","discourse","saas","ai;video;marketing","1/week","false","allowed","true"`);
      }
      const fullCsv = header + rows.join('\n');

      const startTime = Date.now();
      const result = await globalCatalogueImporter.importFromCsv(fullCsv, false);
      const elapsedMs = Date.now() - startTime;

      expect(result.total_rows).toBe(1000);
      expect(result.imported_count).toBe(1000);
      expect(elapsedMs).toBeLessThan(300000); // Must be strictly under 5 minutes!
      console.log(`✓ 1,000 rows imported in ${elapsedMs}ms (${result.speed_rows_per_second} rows/sec)`);
    });
  });

  describe('2. AI Rules Capture & Human Confirmation Flow', () => {
    test('proposes posting rules from community guidelines text', async () => {
      const sampleGuidelines = `
        Welcome to TechFounders!
        1. No self-promotion: strictly zero tolerance for self-promotional pitches or promotional links.
        2. Posting limit: please limit submissions to once a week.
        3. Transparency: all AI-generated content must be labeled as such.
        4. Hyperlinks: place links in first comment only.
      `;

      const proposal = await globalRulesCaptureService.captureRules(
        'TechFounders Community',
        sampleGuidelines,
        'https://techfounders.example.com/rules'
      );

      expect(proposal.status).toBe('pending_human_review');
      expect(proposal.proposed_rules.self_promo_allowed).toBe(false);
      expect(proposal.proposed_rules.frequency_cap).toBe('1/week');
      expect(proposal.proposed_rules.disclosure_required).toBe(true);
      expect(proposal.proposed_rules.link_policy).toBe('first_comment');
    });

    test('requires human confirmation before activating rules', async () => {
      const proposal = await globalRulesCaptureService.captureRules(
        'SaaS Builders',
        'Strictly no promotion allowed. Maximum 1 post per week.'
      );

      expect(proposal.status).toBe('pending_human_review');

      // Human confirms with optional override
      const confirmed = globalRulesCaptureService.confirmRules(
        proposal.id,
        true,
        { frequency_cap: '2/week' },
        'Approved with updated cadence'
      );

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.proposed_rules.frequency_cap).toBe('2/week');
      expect(confirmed.reviewer_notes).toBe('Approved with updated cadence');
    });
  });

  describe('3. Audience Relevance Scorer (1 to 5)', () => {
    test('assigns high score (4-5) to core AI, SaaS, creator, video destinations', () => {
      const highDest: Destination = {
        name: 'AI SaaS Founders Network',
        url: 'https://aisaaspod.com',
        platform_key: 'discourse',
        surface: 'topic',
        category: 'saas',
        audience_tags: ['ai', 'video', 'creators', 'marketing'],
        connector_key: 'discourse'
      };

      const result = globalContentTailoringService.scoreRelevance(highDest);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.reason).toContain('audience alignment');
    });

    test('assigns low score (1-2) to unrelated destinations', () => {
      const lowDest: Destination = {
        name: 'Gardening Enthusiasts Club',
        url: 'https://gardening.example.com',
        platform_key: 'discourse',
        surface: 'topic',
        category: 'hobby',
        audience_tags: ['plants', 'flowers'],
        connector_key: 'discourse'
      };

      const result = globalContentTailoringService.scoreRelevance(lowDest);
      expect(result.score).toBeLessThanOrEqual(2);
    });
  });

  describe('4. Content Tailoring Engine', () => {
    test('adapts forum content with discussion-first framing', () => {
      const inputRendition: Rendition = {
        title: 'New AI Agent Architecture 2026',
        body: 'Here is how autonomous agent pipelines work.'
      };

      const forumDest: Destination = {
        name: 'Discourse Forum',
        url: 'https://forum.example.com',
        platform_key: 'discourse',
        surface: 'topic',
        connector_key: 'discourse'
      };

      const tailored = globalContentTailoringService.tailor(inputRendition, forumDest);
      expect(tailored.tailored.title).toContain('Discussion:');
      expect(tailored.tailored.body).toContain('Would love to hear how other builders are approaching this');
      expect(tailored.adaptations_applied.length).toBeGreaterThanOrEqual(2);
    });

    test('truncates at word boundary without splitting words', () => {
      const longTitle = 'Understanding Decentralized Distributed Autonomous Networks for SaaS Scaling';
      const truncated = globalContentTailoringService.truncateAtWordBoundary(longTitle, 35);
      expect(truncated.length).toBeLessThanOrEqual(35);
      expect(truncated.endsWith('...')).toBe(true);
      // Ensure the word before ellipsis is intact
      expect(truncated).toBe('Understanding Decentralized...');
    });
  });

  describe('5. Advanced Connectors (Hashnode, Slack, MRSS)', () => {
    test('Hashnode, Slack, and MRSS are registered in Connector Registry', () => {
      const list = globalRegistry.list();
      expect(list).toContain('hashnode');
      expect(list).toContain('slack');
      expect(list).toContain('mrss');
    });

    test('Hashnode publishes and verifies in simulation mode', async () => {
      const hn = globalRegistry.get('hashnode');
      const dest: Destination = {
        name: 'Hashnode Blog',
        url: 'https://hashnode.com/@incubrix',
        platform_key: 'hashnode',
        surface: 'story',
        connector_key: 'hashnode'
      };
      const pub = await hn.publish({ title: 'HN Test', body: 'Body' }, dest, {}, 'idemp_hn_1');
      expect(pub.status).toBe('published');
      expect(pub.platform_post_id).toBeDefined();
    });

    test('Slack connector formats and publishes messages', async () => {
      const slack = globalRegistry.get('slack');
      const dest: Destination = {
        name: 'Slack Community',
        url: 'https://hooks.slack.com/services/T00/B00/X00',
        platform_key: 'slack',
        surface: 'message',
        connector_key: 'slack'
      };
      const pub = await slack.publish({ title: 'Slack Update', body: 'New feature live' }, dest, {}, 'idemp_slk_1');
      expect(pub.status).toBe('published');
    });

    test('MRSS connector generates Media RSS syndication XML feed', async () => {
      const mrss = globalRegistry.get('mrss');
      const dest: Destination = {
        name: 'MRSS Channel Feed',
        url: 'https://feed.incubrix.com/channel',
        platform_key: 'mrss',
        surface: 'video_feed',
        connector_key: 'mrss'
      };
      const pub = await mrss.publish(
        {
          title: 'Video Demo',
          body: 'Product walkthrough',
          media_urls: ['https://cdn.incubrix.com/demo.mp4']
        },
        dest,
        {},
        'idemp_mrss_1'
      );
      expect(pub.status).toBe('published');
      expect(pub.live_url).toContain('.xml');
    });
  });
});
