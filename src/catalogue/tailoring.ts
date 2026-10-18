import { Rendition, Destination } from '../types/contract.js';

export interface TailoredResult {
  original: Rendition;
  tailored: Rendition;
  destination_id: string;
  destination_name: string;
  adaptations_applied: string[];
}

export class ContentTailoringService {
  private targetAudienceKeywords = [
    'ai',
    'artificial intelligence',
    'video',
    'creators',
    'marketing',
    'saas',
    'founders',
    'startups',
    'growth',
    'distribution'
  ];

  /**
   * Scores relevance (1-5) against IncuBrix's audience (AI, video, marketing, SaaS, creators, founders)
   */
  public scoreRelevance(destination: Destination): { score: number; reason: string } {
    const textPool = [
      destination.name || '',
      destination.category || '',
      ...(destination.audience_tags || []),
      destination.url || ''
    ]
      .join(' ')
      .toLowerCase();

    let matchedKeywords: string[] = [];
    for (const kw of this.targetAudienceKeywords) {
      if (textPool.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }

    if (matchedKeywords.length >= 3) {
      return {
        score: 5,
        reason: `Exceptional audience alignment with IncuBrix core demographics (${matchedKeywords.join(', ')}). High conversion opportunity.`
      };
    } else if (matchedKeywords.length >= 2) {
      return {
        score: 4,
        reason: `Strong audience fit matching key segments: ${matchedKeywords.join(', ')}.`
      };
    } else if (matchedKeywords.length === 1) {
      return {
        score: 3,
        reason: `Moderate audience alignment matching ${matchedKeywords[0]}. Worth syndicating with tailored framing.`
      };
    } else if (destination.category === 'technology' || destination.category === 'developers') {
      return {
        score: 2,
        reason: `General technical audience. Peripheral fit for SaaS and AI products.`
      };
    }

    return {
      score: 1,
      reason: `Low direct alignment with IncuBrix's core creator and B2B SaaS founder personas.`
    };
  }

  /**
   * Smart Word-Boundary Truncation (never splits a word in half)
   */
  public truncateAtWordBoundary(text: string, maxChars: number): string {
    if (!text || text.length <= maxChars) return text;
    const truncated = text.slice(0, maxChars - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      return `${truncated.slice(0, lastSpace)}...`;
    }
    return `${truncated}...`;
  }

  /**
   * Adapts title, body, formatting, and tags per destination type
   */
  public tailor(rendition: Rendition, destination: Destination): TailoredResult {
    const adaptations: string[] = [];
    const tailored: Rendition = { ...rendition };

    const platformKey = destination.platform_key.toLowerCase();
    const surface = (destination.surface || '').toLowerCase();

    // 1. Forum Framing (Discourse, Lemmy) -> Discussion-first framing
    if (platformKey === 'discourse' || platformKey === 'lemmy' || surface === 'topic') {
      if (tailored.title && !tailored.title.endsWith('?')) {
        tailored.title = `Discussion: ${tailored.title} — what are your thoughts?`;
        adaptations.push('Reframed title into discussion-first question for community forum engagement');
      }
      if (!tailored.body.includes('What do you think?') && !tailored.body.includes('Thoughts?')) {
        tailored.body = `${tailored.body}\n\n**Would love to hear how other builders are approaching this — what has been your experience?**`;
        adaptations.push('Appended open-ended discussion prompt to stimulate thread comments');
      }
    }

    // 2. Article / Blog Framing (Dev.to, Ghost) -> Markdown structure & canonical link
    if (platformKey === 'devto' || platformKey === 'ghost' || surface === 'article') {
      if (!tailored.body.startsWith('#')) {
        tailored.body = `# ${tailored.title || 'IncuBrix Article'}\n\n${tailored.body}`;
        adaptations.push('Structured content with markdown H1 title and canonical headers');
      }
      if (tailored.canonical_url) {
        adaptations.push(`Preserved canonical URL attribution to ${tailored.canonical_url}`);
      }
    }

    // 3. Surface Length Limits (Word-Boundary Truncation)
    const maxTitleLength = surface === 'article' ? 128 : 255;
    if (tailored.title && tailored.title.length > maxTitleLength) {
      tailored.title = this.truncateAtWordBoundary(tailored.title, maxTitleLength);
      adaptations.push(`Truncated title at word boundary to fit ${maxTitleLength} char surface limit`);
    }

    // 4. Hashtag & Mention adaptation
    if (tailored.tags && tailored.tags.length > 0) {
      if (platformKey === 'devto') {
        // Dev.to expects lowercase alphanumeric tags without '#'
        tailored.tags = tailored.tags.map((t) => t.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).slice(0, 4);
        adaptations.push('Formatted tags for Dev.to (lowercase, alphanumeric, max 4)');
      }
    }

    return {
      original: rendition,
      tailored,
      destination_id: destination.id || destination.name,
      destination_name: destination.name,
      adaptations_applied: adaptations
    };
  }
}

export const globalContentTailoringService = new ContentTailoringService();
