import { Destination } from '../types/contract.js';

export class DestinationCatalogue {
  private destinations: Map<string, Destination> = new Map();

  constructor() {
    this.seedDefaultDestinations();
  }

  private seedDefaultDestinations(): void {
    const defaults: Destination[] = [
      {
        id: 'dest_discourse_meta',
        name: 'Discourse Meta Community',
        url: 'http://localhost:3000/mock/discourse',
        platform_key: 'discourse',
        surface: 'topic',
        category: 'community',
        audience_tags: ['saas', 'developers', 'community'],
        language: 'en',
        geo: 'global',
        est_audience: 50000,
        rules_url: 'http://localhost:3000/mock/discourse/guidelines',
        frequency_cap: '10/day',
        self_promo_allowed: false,
        link_policy: 'allowed',
        disclosure_required: true,
        automation_allowed: true,
        connector_key: 'discourse',
        relevance_score: 4,
        relevance_reason: 'High engagement tech and creator forum',
        level: 'L3',
        last_certified_at: new Date().toISOString()
      },
      {
        id: 'dest_lemmy_tech',
        name: 'Lemmy Tech Community',
        url: 'http://localhost:8536',
        platform_key: 'lemmy',
        surface: 'post',
        category: 'technology',
        audience_tags: ['open-source', 'founders', 'ai'],
        language: 'en',
        geo: 'global',
        est_audience: 15000,
        rules_url: 'http://localhost:3000/mock/lemmy/rules',
        frequency_cap: '10/day',
        self_promo_allowed: true,
        link_policy: 'allowed',
        disclosure_required: false,
        automation_allowed: true,
        connector_key: 'lemmy',
        relevance_score: 5,
        relevance_reason: 'Direct audience of open source and SaaS builders',
        level: 'L3',
        last_certified_at: new Date().toISOString(),
        config: { community_id: 2 }
      },
      {
        id: 'dest_devto_main',
        name: 'Dev.to Community',
        url: 'http://localhost:3000/mock/devto',
        platform_key: 'devto',
        surface: 'article',
        category: 'developer_blog',
        audience_tags: ['developers', 'ai', 'saas'],
        language: 'en',
        geo: 'global',
        est_audience: 1000000,
        rules_url: 'http://localhost:3000/mock/devto/terms',
        frequency_cap: '10/day',
        self_promo_allowed: true,
        link_policy: 'allowed',
        disclosure_required: true,
        automation_allowed: true,
        connector_key: 'devto',
        relevance_score: 5,
        relevance_reason: 'Core developer and tech founders demographic',
        level: 'L4',
        last_certified_at: new Date().toISOString()
      },
      {
        id: 'dest_ghost_blog',
        name: 'Ghost Publisher Publication',
        url: 'http://localhost:2368',
        platform_key: 'ghost',
        surface: 'post',
        category: 'blog',
        audience_tags: ['creators', 'marketing', 'video'],
        language: 'en',
        geo: 'global',
        est_audience: 25000,
        rules_url: 'http://localhost:3000/mock/ghost/about',
        frequency_cap: '10/day',
        self_promo_allowed: true,
        link_policy: 'allowed',
        disclosure_required: false,
        automation_allowed: true,
        connector_key: 'ghost',
        relevance_score: 4,
        relevance_reason: 'Independent publication platform for content creators',
        level: 'L4',
        last_certified_at: new Date().toISOString()
      },
      {
        id: 'dest_webhook_partner',
        name: 'Partner Network Webhook',
        url: 'http://localhost:3000/mock/webhook/incoming',
        platform_key: 'webhook',
        surface: 'event',
        category: 'partner',
        audience_tags: ['saas', 'distribution'],
        language: 'en',
        geo: 'global',
        est_audience: 10000,
        frequency_cap: '10/day',
        self_promo_allowed: true,
        link_policy: 'allowed',
        disclosure_required: false,
        automation_allowed: true,
        connector_key: 'webhook',
        relevance_score: 4,
        relevance_reason: 'Direct partner syndication endpoint',
        level: 'L2',
        last_certified_at: new Date().toISOString()
      },
      {
        id: 'dest_assisted_forum',
        name: 'Strict Moderated Indie Hackers Community',
        url: 'http://localhost:3000/mock/assisted/submit',
        platform_key: 'assisted',
        surface: 'manual_pack',
        category: 'founders',
        audience_tags: ['founders', 'saas', 'marketing'],
        language: 'en',
        geo: 'global',
        est_audience: 75000,
        rules_url: 'http://localhost:3000/mock/assisted/guidelines',
        frequency_cap: '10/day',
        self_promo_allowed: false,
        link_policy: 'first_comment',
        disclosure_required: true,
        automation_allowed: false,
        connector_key: 'assisted',
        relevance_score: 5,
        relevance_reason: 'High-value founder community requiring manual touch',
        level: 'L1',
        last_certified_at: new Date().toISOString()
      }
    ];

    for (const d of defaults) {
      this.destinations.set(d.id!, d);
    }
  }

  public get(id: string): Destination | undefined {
    return this.destinations.get(id);
  }

  public list(): Destination[] {
    return Array.from(this.destinations.values());
  }

  public add(destination: Destination): Destination {
    if (!destination.id) {
      destination.id = `dest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    if (!destination.last_certified_at) {
      destination.last_certified_at = new Date().toISOString();
    }
    this.destinations.set(destination.id, destination);
    return destination;
  }

  public demote(id: string, reason: string): Destination | undefined {
    const dest = this.destinations.get(id);
    if (!dest) return undefined;
    dest.level = 'L0'; // Demoted to uncertified catalogue only
    dest.relevance_reason = `Demoted: ${reason}`;
    this.destinations.set(id, dest);
    return dest;
  }
}

export const globalCatalogue = new DestinationCatalogue();
