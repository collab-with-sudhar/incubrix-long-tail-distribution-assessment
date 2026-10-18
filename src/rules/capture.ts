import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { globalCatalogue } from '../catalogue/store.js';
import { AppError } from '../middleware/errorHandler.js';
import { Logger } from '../utils/logger.js';

export interface ProposedRules {
  frequency_cap: string;
  self_promo_allowed: boolean;
  link_policy: 'allowed' | 'no_links' | 'first_comment' | 'domain_whitelist';
  disclosure_required: boolean;
  confidence: number;
  reasoning: {
    frequency_cap_reason: string;
    self_promo_reason: string;
    link_policy_reason: string;
    disclosure_reason: string;
  };
}

export interface RuleProposal {
  id: string;
  destination_id?: string;
  community_name: string;
  rules_url?: string;
  raw_rules_text: string;
  proposed_rules: ProposedRules;
  status: 'pending_human_review' | 'confirmed' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
}

export class RulesCaptureService {
  private proposals: Map<string, RuleProposal> = new Map();

  /**
   * AI step: reads a community's rules and proposes posting rules
   */
  public async captureRules(
    communityName: string,
    rulesText: string,
    rulesUrl?: string,
    destinationId?: string
  ): Promise<RuleProposal> {
    const provider = process.env.AI_PROVIDER || 'mock';
    let proposed: ProposedRules;

    if (provider === 'openai' && process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('mock')) {
      proposed = await this.extractWithOpenAI(rulesText);
    } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      proposed = await this.extractWithGemini(rulesText);
    } else {
      proposed = this.extractWithHeuristics(rulesText);
    }

    const proposal: RuleProposal = {
      id: `prop_${uuidv4()}`,
      destination_id: destinationId,
      community_name: communityName,
      rules_url: rulesUrl,
      raw_rules_text: rulesText,
      proposed_rules: proposed,
      status: 'pending_human_review',
      created_at: new Date().toISOString()
    };

    this.proposals.set(proposal.id, proposal);
    Logger.info(`AI Rules proposed for community: ${communityName} [Proposal ID: ${proposal.id}]`, {
      proposal_id: proposal.id,
      community_name: communityName
    });

    return proposal;
  }

  /**
   * Human confirmation step: person confirms or tweaks proposed rules before activation
   */
  public confirmRules(
    proposalId: string,
    approved: boolean,
    overrides?: Partial<ProposedRules>,
    reviewerNotes?: string
  ): RuleProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new AppError('DEST_SPEC_VIOLATION', `Proposal not found: ${proposalId}`, 404);
    }

    if (!approved) {
      proposal.status = 'rejected';
      proposal.reviewed_at = new Date().toISOString();
      proposal.reviewer_notes = reviewerNotes || 'Rejected by human reviewer';
      return proposal;
    }

    if (overrides) {
      proposal.proposed_rules = { ...proposal.proposed_rules, ...overrides };
    }

    proposal.status = 'confirmed';
    proposal.reviewed_at = new Date().toISOString();
    proposal.reviewer_notes = reviewerNotes || 'Confirmed by human reviewer';

    // If linked to an existing destination in the catalogue, apply confirmed rules
    if (proposal.destination_id) {
      const dest = globalCatalogue.get(proposal.destination_id);
      if (dest) {
        dest.frequency_cap = proposal.proposed_rules.frequency_cap;
        dest.self_promo_allowed = proposal.proposed_rules.self_promo_allowed;
        dest.link_policy = proposal.proposed_rules.link_policy;
        dest.disclosure_required = proposal.proposed_rules.disclosure_required;
        Logger.info(`Applied confirmed rules to destination: ${dest.id}`, { destination_id: dest.id });
      }
    }

    return proposal;
  }

  public getProposal(proposalId: string): RuleProposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * Deterministic semantic heuristic engine (zero-key fallback compliant with Integration Standard 1)
   */
  private extractWithHeuristics(text: string): ProposedRules {
    const lower = text.toLowerCase();

    // 1. Frequency cap detection
    let cap = '1/day';
    let capReason = 'Default standard frequency cap';
    if (lower.includes('once a week') || lower.includes('1 per week') || lower.includes('weekly')) {
      cap = '1/week';
      capReason = 'Detected explicit weekly cadence rule ("once a week / weekly")';
    } else if (lower.includes('twice a day') || lower.includes('2 per day')) {
      cap = '2/day';
      capReason = 'Detected twice daily frequency allowance';
    } else if (lower.includes('once a month') || lower.includes('monthly')) {
      cap = '1/month';
      capReason = 'Detected strict monthly frequency restriction';
    }

    // 2. Self-promotion detection
    let selfPromo = true;
    let promoReason = 'Community guidelines do not explicitly forbid self-promotion';
    if (
      lower.includes('no self-promotion') ||
      lower.includes('no self promo') ||
      lower.includes('strictly no promotion') ||
      lower.includes('no advertising') ||
      lower.includes('zero tolerance for promotional')
    ) {
      selfPromo = false;
      promoReason = 'Detected strict ban on self-promotion or advertising';
    }

    // 3. Link policy detection
    let linkPolicy: 'allowed' | 'no_links' | 'first_comment' = 'allowed';
    let linkReason = 'External hyperlinks are permitted';
    if (lower.includes('no external links') || lower.includes('links not allowed') || lower.includes('no links in post')) {
      linkPolicy = 'no_links';
      linkReason = 'Detected strict policy disallowing outbound links in content';
    } else if (lower.includes('link in comment') || lower.includes('first comment') || lower.includes('links in comments only')) {
      linkPolicy = 'first_comment';
      linkReason = 'Detected guideline asking links to be kept in the first comment';
    }

    // 4. AI-content disclosure detection
    let disclosureRequired = false;
    let disclosureReason = 'No mandatory AI attribution required';
    if (
      lower.includes('ai disclosure') ||
      lower.includes('ai-generated content must be labeled') ||
      lower.includes('disclose ai') ||
      lower.includes('label ai') ||
      lower.includes('indicate if ai was used')
    ) {
      disclosureRequired = true;
      disclosureReason = 'Detected community rule requiring explicit labeling of AI-assisted content';
    }

    return {
      frequency_cap: cap,
      self_promo_allowed: selfPromo,
      link_policy: linkPolicy,
      disclosure_required: disclosureRequired,
      confidence: 0.92,
      reasoning: {
        frequency_cap_reason: capReason,
        self_promo_reason: promoReason,
        link_policy_reason: linkReason,
        disclosure_reason: disclosureReason
      }
    };
  }

  private async extractWithOpenAI(text: string): Promise<ProposedRules> {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert community guidelines parser for IncuBrix distribution. Extract posting rules into JSON with fields: frequency_cap (e.g. 1/week, 1/day), self_promo_allowed (boolean), link_policy ("allowed"|"no_links"|"first_comment"), disclosure_required (boolean), and reasoning (object with reasons for each field).'
          },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' }
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 }
    );

    const parsed = JSON.parse(response.data.choices[0].message.content);
    return {
      frequency_cap: parsed.frequency_cap || '1/day',
      self_promo_allowed: Boolean(parsed.self_promo_allowed),
      link_policy: parsed.link_policy || 'allowed',
      disclosure_required: Boolean(parsed.disclosure_required),
      confidence: 0.95,
      reasoning: parsed.reasoning || {
        frequency_cap_reason: 'Parsed via OpenAI LLM',
        self_promo_reason: 'Parsed via OpenAI LLM',
        link_policy_reason: 'Parsed via OpenAI LLM',
        disclosure_reason: 'Parsed via OpenAI LLM'
      }
    };
  }

  private async extractWithGemini(text: string): Promise<ProposedRules> {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `Analyze these community rules and output JSON with frequency_cap (e.g. "1/week", "1/day"), self_promo_allowed (boolean), link_policy ("allowed"|"no_links"|"first_comment"), disclosure_required (boolean), reasoning (object with reasons):\n\n${text}`;

    const res = await axios.post(
      url,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json' }
      },
      { timeout: 15000 }
    );

    const content = res.data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(content);
    return {
      frequency_cap: parsed.frequency_cap || '1/day',
      self_promo_allowed: Boolean(parsed.self_promo_allowed),
      link_policy: parsed.link_policy || 'allowed',
      disclosure_required: Boolean(parsed.disclosure_required),
      confidence: 0.95,
      reasoning: parsed.reasoning || {
        frequency_cap_reason: 'Parsed via Gemini',
        self_promo_reason: 'Parsed via Gemini',
        link_policy_reason: 'Parsed via Gemini',
        disclosure_reason: 'Parsed via Gemini'
      }
    };
  }
}

export const globalRulesCaptureService = new RulesCaptureService();
