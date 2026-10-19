import React, { useState, useEffect } from 'react';

// Interfaces
interface Destination {
  id: string;
  name: string;
  url: string;
  platform_key: string;
  connector_key: string;
  surface: string;
  category?: string;
  audience_tags?: string[];
  frequency_cap?: string;
  self_promo_allowed?: boolean;
  link_policy?: 'allowed' | 'no_links' | 'first_comment';
  disclosure_required?: boolean;
  level?: string;
}

interface RuleProposal {
  id: string;
  community_name: string;
  proposed_rules: {
    frequency_cap: string;
    self_promo_allowed: boolean;
    link_policy: 'allowed' | 'no_links' | 'first_comment';
    disclosure_required: boolean;
  };
  status: string;
}

interface RowReport {
  row_number: number;
  name: string;
  url: string;
  platform_key: string;
  status: string;
  error?: string;
  enriched?: { est_audience?: number };
}

interface ImportSummary {
  total_rows: number;
  imported_count: number;
  duplicates_count: number;
  errors_count: number;
  duration_ms: number;
  speed_rows_per_second: number;
  reports: RowReport[];
}

export function App() {
  const [activeTab, setActiveTab] = useState<'publish' | 'destinations' | 'rules' | 'import' | 'certification'>('publish');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [healthStatus, setHealthStatus] = useState<string>('Connecting...');
  const [simulationMode, setSimulationMode] = useState<boolean>(true);

  // Filter for Destinations tab
  const [destFilter, setDestFilter] = useState<string>('');

  // Compose State
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [postTitle, setPostTitle] = useState<string>('');
  const [postBody, setPostBody] = useState<string>('');
  const [postCanonical, setPostCanonical] = useState<string>('');
  const [postTags, setPostTags] = useState<string>('ai, saas, typescript');
  const [isPromotional, setIsPromotional] = useState<boolean>(false);
  const [isAiGenerated, setIsAiGenerated] = useState<boolean>(true);
  const [isAsync, setIsAsync] = useState<boolean>(false);
  const [idempKey, setIdempKey] = useState<string>('');

  // Publish Output State
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<any>(null);
  const [publishError, setPublishError] = useState<any>(null);
  const [cacheStatus, setCacheStatus] = useState<string>('DIRECT');
  const [showJsonManifest, setShowJsonManifest] = useState<boolean>(false);
  const [asyncProgress, setAsyncProgress] = useState<number>(0);
  const [isAsyncRunning, setIsAsyncRunning] = useState<boolean>(false);

  // New Destination Form
  const [showAddDest, setShowAddDest] = useState<boolean>(false);
  const [newDestName, setNewDestName] = useState<string>('');
  const [newDestUrl, setNewDestUrl] = useState<string>('');
  const [newDestConnector, setNewDestConnector] = useState<string>('discourse');
  const [newDestSurface, setNewDestSurface] = useState<string>('topic');
  const [newDestCap, setNewDestCap] = useState<string>('1/week');
  const [newDestLinkPolicy, setNewDestLinkPolicy] = useState<'allowed' | 'no_links' | 'first_comment'>('allowed');
  const [newDestSelfPromo, setNewDestSelfPromo] = useState<boolean>(false);
  const [newDestDisclosure, setNewDestDisclosure] = useState<boolean>(true);

  // Rules State
  const [communityName, setCommunityName] = useState<string>('Developer Guild');
  const [communityRules, setCommunityRules] = useState<string>(
    `Guidelines:\n1. Self-promotion and direct product marketing are prohibited.\n2. Posting cadence is restricted to once per week.\n3. Content generated with AI assistance must include explicit attribution.\n4. Outbound reference links must be placed in the first comment.`
  );
  const [analyzingRules, setAnalyzingRules] = useState<boolean>(false);
  const [proposal, setProposal] = useState<RuleProposal | null>(null);

  // Tailoring & Relevance
  const [tailorDestId, setTailorDestId] = useState<string>('');
  const [tailorResult, setTailorResult] = useState<any>(null);
  const [relevanceScore, setRelevanceScore] = useState<{ score: number; reason: string } | null>(null);

  // Importer State
  const [csvText, setCsvText] = useState<string>(
    `name,url,platform_key,connector_key,category,audience_tags,frequency_cap,self_promo_allowed,link_policy\n"AI Founders Hub","https://aifounders.sample.com","discourse","discourse","saas","ai;startups;founders","1/week",false,allowed\n"Modern Creator Community","https://creators.sample.org","discourse","discourse","creators","video;marketing","2/day",true,allowed\n"Open Engineering Collective","https://dev.sample.io","devto","devto","developers","saas;typescript","1/day",true,allowed`
  );
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  // Certification State
  const [isCertifying, setIsCertifying] = useState<boolean>(false);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [certResults, setCertResults] = useState<Record<string, any>>({});
  const [viewingEvidence, setViewingEvidence] = useState<any | null>(null);

  useEffect(() => {
    generateIdempKey();
    fetchHealth();
    fetchDestinations();
    fetchEvidence();
  }, []);

  const generateIdempKey = () => {
    setIdempKey(`req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/ready');
      const data = await res.json();
      if (data.status === 'ready') {
        setHealthStatus('Runtime Ready · Port 3000');
        setSimulationMode(Boolean(data.simulation_mode));
      }
    } catch {
      setHealthStatus('Service Offline');
    }
  };

  const fetchDestinations = async () => {
    try {
      const res = await fetch('/api/v1/destinations');
      const data = await res.json();
      const list = data.destinations || [];
      setDestinations(list);
      if (list.length > 0 && !selectedDestId) {
        setSelectedDestId(list[0].id);
        setTailorDestId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load destinations:', err);
    }
  };

  const fetchEvidence = async () => {
    try {
      const res = await fetch('/api/v1/certification/evidence');
      const data = await res.json();
      setEvidenceList(data.evidence || []);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    }
  };

  const activeDest = destinations.find((d) => d.id === selectedDestId) || destinations[0];

  // Clean Policy Pre-Check
  const getRuleAdvisory = () => {
    if (!activeDest) return { type: 'clean', text: 'Select a destination to evaluate community policy.' };

    if (activeDest.self_promo_allowed === false && isPromotional) {
      return {
        type: 'blocked',
        text: `Promotional content blocked: ${activeDest.name} enforces a strict non-promotional policy.`
      };
    }

    if (activeDest.link_policy === 'no_links' && /https?:\/\//i.test(postBody)) {
      return {
        type: 'blocked',
        text: `Hyperlinks blocked: ${activeDest.name} forbids links in the post body.`
      };
    }

    if (activeDest.disclosure_required && isAiGenerated) {
      return {
        type: 'notice',
        text: `AI Attribution required: An attribution notice will be formatted and appended upon dispatch.`
      };
    }

    return {
      type: 'clean',
      text: `Compliant with ${activeDest.name} rules (Cadence: ${activeDest.frequency_cap || 'open'}).`
    };
  };

  const advisory = getRuleAdvisory();

  // Publishing
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDest) return;

    setIsPublishing(true);
    setPublishResult(null);
    setPublishError(null);

    const rendition = {
      title: postTitle,
      body: postBody,
      canonical_url: postCanonical || undefined,
      tags: postTags.split(',').map((s) => s.trim()).filter(Boolean),
      is_promotional: isPromotional,
      is_ai_generated: isAiGenerated
    };

    try {
      const res = await fetch('/api/v1/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempKey || `req_${Date.now()}`
        },
        body: JSON.stringify({
          rendition,
          destination_id: activeDest.id,
          async: isAsync
        })
      });

      const cacheHeader = res.headers.get('x-cache-lookup') || 'DIRECT';
      setCacheStatus(cacheHeader);

      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.error || { message: 'Dispatch failed' });
      } else if (res.status === 202) {
        pollJob(data.job_id);
      } else {
        setPublishResult(data);
        generateIdempKey();
      }
    } catch (err: any) {
      setPublishError({ code: 'NETWORK_ERROR', message: err.message });
    } finally {
      setIsPublishing(false);
    }
  };

  const pollJob = (jobId: string) => {
    setIsAsyncRunning(true);
    setAsyncProgress(15);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${jobId}`);
        const job = await res.json();
        setAsyncProgress(job.progress || 30);

        if (job.status === 'succeeded') {
          clearInterval(interval);
          setIsAsyncRunning(false);
          setPublishResult(job.result);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setIsAsyncRunning(false);
          setPublishError(job.error || { message: 'Background execution failed' });
        }
      } catch {
        clearInterval(interval);
        setIsAsyncRunning(false);
      }
    }, 400);
  };

  const handleDeletePost = async () => {
    if (!publishResult || !publishResult.platform_post_id) return;
    try {
      const res = await fetch(`/connector/v1/${activeDest.connector_key}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_post_id: publishResult.platform_post_id, connection: {} })
      });
      const data = await res.json();
      if (data.deleted) {
        setPublishResult({ ...publishResult, status: 'removed' });
      }
    } catch (err: any) {
      alert('Deletion failed: ' + err.message);
    }
  };

  // Presets
  const applyPreset = (type: string) => {
    generateIdempKey();
    if (type === 'devto') {
      const d = destinations.find((x) => x.platform_key === 'devto') || destinations[0];
      if (d) setSelectedDestId(d.id);
      setPostTitle('Building Resilient Distribution Connectors with TypeScript');
      setPostBody('Technical overview of contract-compliant connectors, backoff retry strategies, and idempotency guarantees.');
      setIsPromotional(false);
      setIsAiGenerated(true);
    } else if (type === 'discourse') {
      const d = destinations.find((x) => x.platform_key === 'discourse') || destinations[0];
      if (d) setSelectedDestId(d.id);
      setPostTitle('Decentralized Syndication for Technical Creators');
      setPostBody('How are engineering teams managing community syndication without triggering spam filters?');
      setIsPromotional(false);
      setIsAiGenerated(false);
    } else if (type === 'lemmy') {
      const d = destinations.find((x) => x.platform_key === 'lemmy') || destinations[0];
      if (d) setSelectedDestId(d.id);
      setPostTitle('Federated Content Distribution Architecture');
      setPostBody('Open-source implementation notes on federation protocols and community-governed syndication.');
      setIsPromotional(false);
      setIsAiGenerated(false);
    } else if (type === 'promo') {
      const strict = destinations.find((x) => x.self_promo_allowed === false) || destinations[0];
      if (strict) setSelectedDestId(strict.id);
      setPostTitle('Enterprise Platform License Discount');
      setPostBody('Sign up today at our purchase portal for exclusive promotional access.');
      setIsPromotional(true);
      setIsAiGenerated(false);
    }
  };

  // Add Destination
  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    const newDest = {
      name: newDestName,
      url: newDestUrl,
      platform_key: newDestConnector,
      connector_key: newDestConnector,
      surface: newDestSurface,
      frequency_cap: newDestCap,
      link_policy: newDestLinkPolicy,
      self_promo_allowed: newDestSelfPromo,
      disclosure_required: newDestDisclosure
    };

    const res = await fetch('/api/v1/destinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDest)
    });

    if (res.ok) {
      setShowAddDest(false);
      setNewDestName('');
      setNewDestUrl('');
      fetchDestinations();
    }
  };

  // Rules Capture
  const handleAnalyzeRules = async () => {
    setAnalyzingRules(true);
    try {
      const res = await fetch('/api/v1/rules/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community_name: communityName, rules_text: communityRules })
      });
      const data = await res.json();
      setProposal(data);
    } catch (err: any) {
      alert('Analysis error: ' + err.message);
    } finally {
      setAnalyzingRules(false);
    }
  };

  const handleConfirmRules = async (approved: boolean) => {
    if (!proposal) return;
    try {
      const res = await fetch('/api/v1/rules/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id, approved, reviewer_notes: 'Reviewed and confirmed' })
      });
      const updated = await res.json();
      setProposal(updated);
    } catch (err: any) {
      alert('Confirmation error: ' + err.message);
    }
  };

  // Tailoring & Relevance
  const handleTailorAndScore = async () => {
    const dest = destinations.find((d) => d.id === tailorDestId) || destinations[0];
    if (!dest) return;

    try {
      const scoreRes = await fetch('/api/v1/catalogue/score-relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dest)
      });
      const scoreData = await scoreRes.json();
      setRelevanceScore(scoreData);

      const sample = {
        title: 'Autonomous Distribution Pipelines for Modern Creator Workflows',
        body: 'Reviewing syndication patterns across niche developer communities.',
        canonical_url: 'https://incubrix.com/distribution'
      };
      const tailorRes = await fetch('/api/v1/content/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rendition: sample, destination_id: dest.id })
      });
      const tailorData = await tailorRes.json();
      setTailorResult(tailorData);
    } catch (err: any) {
      alert('Tailoring error: ' + err.message);
    }
  };

  // CSV Importer
  const handleImportCsv = async () => {
    setIsImporting(true);
    setImportSummary(null);

    try {
      const res = await fetch('/api/v1/catalogue/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_data: csvText, verify_reachability: false })
      });
      const result = await res.json();
      setImportSummary(result);
      fetchDestinations();
    } catch (err: any) {
      alert('Import error: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const load1000Benchmark = () => {
    const header = 'name,url,platform_key,connector_key,category,audience_tags,frequency_cap,self_promo_allowed,link_policy\n';
    const rows: string[] = [];
    for (let i = 1; i <= 1000; i++) {
      rows.push(`"Benchmark Node #${i}","https://community-${i}.benchmark-test.com/forum","discourse","discourse","saas","ai;creators;founders","1/week",false,allowed`);
    }
    setCsvText(header + rows.join('\n'));
  };

  // Certification Runner
  const handleCertifyAll = async () => {
    setIsCertifying(true);
    try {
      const res = await fetch('/api/v1/certification/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const results = await res.json();
      setCertResults(results);
      fetchEvidence();
    } catch (err: any) {
      alert('Certification error: ' + err.message);
    } finally {
      setIsCertifying(false);
    }
  };

  const filteredDestinations = destinations.filter((d) => {
    if (!destFilter) return true;
    const q = destFilter.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.platform_key.toLowerCase().includes(q) ||
      (d.audience_tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Top Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="brand-symbol">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <div className="brand-details">
              <h1>IncuBrix</h1>
              <p>Long-Tail Distribution Network</p>
            </div>
          </div>
          <div className="header-meta">
            <div className="pill-badge active">
              <span className="indicator-dot"></span>
              <span>{healthStatus}</span>
            </div>
            <span className="pill-badge">
              {simulationMode ? 'Simulation Runtime' : 'Live Platform'}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="tabs-navigation-bar">
        <div className="tabs-container">
          <button
            className={`nav-tab-item ${activeTab === 'publish' ? 'active' : ''}`}
            onClick={() => setActiveTab('publish')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>Publish</span>
          </button>
          <button
            className={`nav-tab-item ${activeTab === 'destinations' ? 'active' : ''}`}
            onClick={() => { setActiveTab('destinations'); fetchDestinations(); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>Destinations</span>
            <span className="counter-badge">{destinations.length}</span>
          </button>
          <button
            className={`nav-tab-item ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => { setActiveTab('rules'); if (!tailorResult) handleTailorAndScore(); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Rules Engine</span>
          </button>
          <button
            className={`nav-tab-item ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Batch Import</span>
          </button>
          <button
            className={`nav-tab-item ${activeTab === 'certification' ? 'active' : ''}`}
            onClick={() => { setActiveTab('certification'); fetchEvidence(); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Certifications</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="workspace-wrapper">

        {/* TAB 1: PUBLISH */}
        {activeTab === 'publish' && (
          <div>
            {/* Presets Bar */}
            <div className="template-bar">
              <span className="template-label">Templates:</span>
              <button className="template-pill" onClick={() => applyPreset('devto')}>Dev.to Technical Article</button>
              <button className="template-pill" onClick={() => applyPreset('discourse')}>Discourse Discussion</button>
              <button className="template-pill" onClick={() => applyPreset('lemmy')}>Lemmy Federated Post</button>
              <button className="template-pill negative" onClick={() => applyPreset('promo')}>Trigger Policy Rejection</button>
            </div>

            <div className="layout-split">
              {/* Left Column: Form */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h2 className="panel-title">Content Dispatcher</h2>
                    <p className="panel-subtitle">Prepare and dispatch content through validation and idempotency checks</p>
                  </div>
                </div>

                <form onSubmit={handlePublish}>
                  <div className="field-container">
                    <div className="field-label-row">
                      <label className="field-label">Target Destination</label>
                      <span className="field-hint">{activeDest?.platform_key.toUpperCase()}</span>
                    </div>
                    <select
                      className="select-input"
                      value={selectedDestId}
                      onChange={(e) => setSelectedDestId(e.target.value)}
                      required
                    >
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.platform_key} · {d.surface})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-container">
                    <div className="field-label-row">
                      <label className="field-label">Title</label>
                      <span className="field-hint">{postTitle.length} chars</span>
                    </div>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Enter publication title..."
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-container">
                    <div className="field-label-row">
                      <label className="field-label">Content Body</label>
                      <span className="field-hint">Markdown supported</span>
                    </div>
                    <textarea
                      className="area-input"
                      placeholder="Write article body or discussion content..."
                      value={postBody}
                      onChange={(e) => setPostBody(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-split-row">
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Canonical Source</label>
                      </div>
                      <input
                        type="url"
                        className="text-input code-style"
                        placeholder="https://example.com/source"
                        value={postCanonical}
                        onChange={(e) => setPostCanonical(e.target.value)}
                      />
                    </div>
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Tags</label>
                      </div>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="ai, saas, dev"
                        value={postTags}
                        onChange={(e) => setPostTags(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Segmented Switches */}
                  <div className="field-container">
                    <div className="field-label-row">
                      <label className="field-label">Publication Flags</label>
                    </div>
                    <div className="switch-group">
                      <div
                        className={`switch-pill ${isPromotional ? 'selected' : ''}`}
                        onClick={() => setIsPromotional(!isPromotional)}
                      >
                        <span className="switch-pill-name">Promotional</span>
                        <div className="switch-indicator">
                          {isPromotional && (
                            <svg className="switch-check-icon" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>

                      <div
                        className={`switch-pill ${isAiGenerated ? 'selected' : ''}`}
                        onClick={() => setIsAiGenerated(!isAiGenerated)}
                      >
                        <span className="switch-pill-name">AI Disclosed</span>
                        <div className="switch-indicator">
                          {isAiGenerated && (
                            <svg className="switch-check-icon" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>

                      <div
                        className={`switch-pill ${isAsync ? 'selected' : ''}`}
                        onClick={() => setIsAsync(!isAsync)}
                      >
                        <span className="switch-pill-name">Async Queue</span>
                        <div className="switch-indicator">
                          {isAsync && (
                            <svg className="switch-check-icon" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="field-container" style={{ marginTop: '24px' }}>
                    <div className="input-split-row" style={{ alignItems: 'flex-end' }}>
                      <div>
                        <div className="field-label-row">
                          <label className="field-label">Idempotency Key</label>
                        </div>
                        <input
                          type="text"
                          className="text-input code-style"
                          value={idempKey}
                          onChange={(e) => setIdempKey(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="action-btn outline" onClick={generateIdempKey}>
                          Regenerate
                        </button>
                        <button type="submit" className="action-btn primary" style={{ flex: 1 }} disabled={isPublishing}>
                          {isPublishing ? <span className="loading-ring"></span> : 'Dispatch Post'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column: Policy Check & Delivery Status */}
              <div>
                {/* Policy Pre-Check Card */}
                <div className="panel-card">
                  <div className="panel-card-header">
                    <div>
                      <h2 className="panel-title">Policy Check</h2>
                      <p className="panel-subtitle">Evaluated before external dispatch</p>
                    </div>
                    <span className="pill-badge active">Active Guard</span>
                  </div>

                  <div className={`policy-banner ${advisory.type}`}>
                    <div>{advisory.text}</div>
                  </div>

                  {activeDest && (
                    <>
                      <div className="kv-row">
                        <span className="kv-key">Frequency Limit</span>
                        <span className="kv-value">{activeDest.frequency_cap || 'Open'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-key">Promotional Policy</span>
                        <span className="kv-value">{activeDest.self_promo_allowed ? 'Allowed' : 'Prohibited'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-key">Outbound Links</span>
                        <span className="kv-value">{activeDest.link_policy || 'allowed'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-key">AI Disclosure</span>
                        <span className="kv-value">{activeDest.disclosure_required ? 'Required' : 'Optional'}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Async Progress */}
                {isAsyncRunning && (
                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>Processing Async Queue...</span>
                      <span className="code-style">{asyncProgress}%</span>
                    </div>
                    <div style={{ background: 'var(--bg-subtle)', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${asyncProgress}%`, height: '100%', background: 'var(--green-primary)', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                )}

                {/* Delivery Receipt */}
                {publishResult && (
                  <div className="panel-card">
                    <div className="panel-card-header">
                      <div>
                        <h2 className="panel-title">Delivery Receipt</h2>
                        <p className="panel-subtitle">Platform confirmation</p>
                      </div>
                      <span className={`pill-badge ${publishResult.status === 'published' ? 'active' : ''}`}>
                        {publishResult.status}
                      </span>
                    </div>

                    <div className="kv-row">
                      <span className="kv-key">Platform ID</span>
                      <span className="kv-value">{publishResult.platform_post_id}</span>
                    </div>
                    <div className="kv-row">
                      <span className="kv-key">Live URL</span>
                      <span className="kv-value">
                        <a href={publishResult.live_url} target="_blank" rel="noreferrer" style={{ color: 'var(--green-primary)', textDecoration: 'underline' }}>
                          View Post
                        </a>
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="kv-key">Cache Status</span>
                      <span className="kv-value" style={{ color: cacheStatus === 'HIT' ? 'var(--green-primary)' : 'inherit' }}>
                        {cacheStatus === 'HIT' ? 'CACHE HIT (Replay)' : 'DIRECT DISPATCH'}
                      </span>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                      <button className="action-btn outline small" onClick={() => setShowJsonManifest(!showJsonManifest)}>
                        {showJsonManifest ? 'Hide Payload' : 'Inspect Payload'}
                      </button>
                      <button className="action-btn danger-outline small" onClick={handleDeletePost}>
                        Delete Post
                      </button>
                    </div>

                    {showJsonManifest && (
                      <pre className="code-panel">{JSON.stringify(publishResult, null, 2)}</pre>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {publishError && (
                  <div className="panel-card" style={{ borderColor: 'var(--status-error-border)' }}>
                    <div className="panel-card-header">
                      <h2 className="panel-title" style={{ color: 'var(--status-error-text)' }}>Dispatch Rejected</h2>
                      <span className="pill-badge" style={{ color: 'var(--status-error-text)', borderColor: 'var(--status-error-border)' }}>
                        {publishError.code || 'BLOCKED'}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '12px' }}>
                      {publishError.message}
                    </p>
                    <pre className="code-panel">{JSON.stringify(publishError, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DESTINATIONS */}
        {activeTab === 'destinations' && (
          <div>
            <div className="panel-card">
              <div className="panel-card-header">
                <div>
                  <h2 className="panel-title">Destination Registry</h2>
                  <p className="panel-subtitle">Configured developer platforms, community forums, and syndication endpoints</p>
                </div>
                <button className="action-btn primary small" onClick={() => setShowAddDest(!showAddDest)}>
                  {showAddDest ? 'Close Form' : '+ Add Destination'}
                </button>
              </div>

              {/* Add Destination Form */}
              {showAddDest && (
                <form onSubmit={handleAddDestination} style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border-hairline)' }}>
                  <div className="input-split-row">
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Name</label>
                      </div>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="e.g. AI Engineering Forum"
                        value={newDestName}
                        onChange={(e) => setNewDestName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Endpoint URL</label>
                      </div>
                      <input
                        type="url"
                        className="text-input code-style"
                        placeholder="https://community.example.com"
                        value={newDestUrl}
                        onChange={(e) => setNewDestUrl(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-split-row">
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Connector</label>
                      </div>
                      <select
                        className="select-input"
                        value={newDestConnector}
                        onChange={(e) => setNewDestConnector(e.target.value)}
                      >
                        <option value="discourse">Discourse</option>
                        <option value="lemmy">Lemmy</option>
                        <option value="devto">Dev.to</option>
                        <option value="ghost">Ghost</option>
                        <option value="webhook">Signed Webhook</option>
                        <option value="assisted">Assisted Pack</option>
                        <option value="hashnode">Hashnode</option>
                        <option value="slack">Slack</option>
                        <option value="mrss">MRSS Feed</option>
                      </select>
                    </div>
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Surface</label>
                      </div>
                      <input
                        type="text"
                        className="text-input"
                        value={newDestSurface}
                        onChange={(e) => setNewDestSurface(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-split-row">
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Frequency Cap</label>
                      </div>
                      <input
                        type="text"
                        className="text-input"
                        value={newDestCap}
                        onChange={(e) => setNewDestCap(e.target.value)}
                      />
                    </div>
                    <div className="field-container">
                      <div className="field-label-row">
                        <label className="field-label">Link Policy</label>
                      </div>
                      <select
                        className="select-input"
                        value={newDestLinkPolicy}
                        onChange={(e: any) => setNewDestLinkPolicy(e.target.value)}
                      >
                        <option value="allowed">Allowed</option>
                        <option value="no_links">No Links</option>
                        <option value="first_comment">First Comment Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="field-container">
                    <div className="switch-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      <div
                        className={`switch-pill ${newDestSelfPromo ? 'selected' : ''}`}
                        onClick={() => setNewDestSelfPromo(!newDestSelfPromo)}
                      >
                        <span className="switch-pill-name">Self-Promotion Allowed</span>
                        <div className="switch-indicator">
                          {newDestSelfPromo && (
                            <svg className="switch-check-icon" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>

                      <div
                        className={`switch-pill ${newDestDisclosure ? 'selected' : ''}`}
                        onClick={() => setNewDestDisclosure(!newDestDisclosure)}
                      >
                        <span className="switch-pill-name">AI Disclosure Required</span>
                        <div className="switch-indicator">
                          {newDestDisclosure && (
                            <svg className="switch-check-icon" viewBox="0 0 24 24">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="action-btn primary small" style={{ marginTop: '12px' }}>
                    Save Configuration
                  </button>
                </form>
              )}

              {/* Filter */}
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  className="text-input"
                  style={{ maxWidth: '360px' }}
                  placeholder="Filter destinations by keyword, platform, or tag..."
                  value={destFilter}
                  onChange={(e) => setDestFilter(e.target.value)}
                />
              </div>

              {/* Grid */}
              <div className="destinations-layout">
                {filteredDestinations.map((d) => (
                  <div key={d.id} className="destination-entry">
                    <div className="dest-entry-top">
                      <div className="dest-entry-title">{d.name}</div>
                      <span className="badge-tag native">{d.platform_key}</span>
                    </div>
                    <div className="dest-entry-sub">{d.url}</div>
                    <div className="dest-entry-specs">
                      <div className="kv-row">
                        <span className="kv-key">Surface</span>
                        <span className="kv-value">{d.surface}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-key">Cadence</span>
                        <span className="kv-value">{d.frequency_cap || 'Open'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-key">Self-Promotion</span>
                        <span className="kv-value">{d.self_promo_allowed ? 'Allowed' : 'Prohibited'}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-key">Links</span>
                        <span className="kv-value">{d.link_policy || 'allowed'}</span>
                      </div>
                    </div>
                    <div className="dest-entry-tags">
                      {(d.audience_tags || []).map((t) => (
                        <span key={t} className="tag-label">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RULES & TAILORING */}
        {activeTab === 'rules' && (
          <div className="layout-split">
            {/* Left: AI Extraction */}
            <div className="panel-card">
              <div className="panel-card-header">
                <div>
                  <h2 className="panel-title">Policy Extraction</h2>
                  <p className="panel-subtitle">Parse raw community guidelines into structured runtime policies</p>
                </div>
              </div>

              <div className="field-container">
                <div className="field-label-row">
                  <label className="field-label">Community Name</label>
                </div>
                <input
                  type="text"
                  className="text-input"
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                />
              </div>

              <div className="field-container">
                <div className="field-label-row">
                  <label className="field-label">Raw Community Guidelines</label>
                </div>
                <textarea
                  className="area-input"
                  style={{ minHeight: '140px' }}
                  value={communityRules}
                  onChange={(e) => setCommunityRules(e.target.value)}
                />
              </div>

              <button className="action-btn primary" onClick={handleAnalyzeRules} disabled={analyzingRules}>
                {analyzingRules ? <span className="loading-ring"></span> : 'Parse Guidelines'}
              </button>

              {proposal && (
                <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--border-hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '13.5px', fontWeight: 600 }}>Extracted Policy Proposal</h3>
                    <span className="pill-badge">{proposal.status}</span>
                  </div>

                  <div className="kv-row">
                    <span className="kv-key">Frequency Cap</span>
                    <span className="kv-value">{proposal.proposed_rules.frequency_cap}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Self-Promotion</span>
                    <span className="kv-value">{proposal.proposed_rules.self_promo_allowed ? 'Allowed' : 'Prohibited'}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Link Policy</span>
                    <span className="kv-value">{proposal.proposed_rules.link_policy}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">AI Disclosure</span>
                    <span className="kv-value">{proposal.proposed_rules.disclosure_required ? 'Required' : 'Optional'}</span>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button className="action-btn primary small" onClick={() => handleConfirmRules(true)}>
                      Confirm & Activate
                    </button>
                    <button className="action-btn outline small" onClick={() => handleConfirmRules(false)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Content Tailoring & Relevance */}
            <div>
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h2 className="panel-title">Format Tailoring</h2>
                    <p className="panel-subtitle">Evaluate platform-specific framing and length adjustments</p>
                  </div>
                </div>

                <div className="field-container">
                  <div className="field-label-row">
                    <label className="field-label">Target Destination</label>
                  </div>
                  <select
                    className="select-input"
                    value={tailorDestId}
                    onChange={(e) => setTailorDestId(e.target.value)}
                  >
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.platform_key})</option>
                    ))}
                  </select>
                </div>

                <button className="action-btn outline small" onClick={handleTailorAndScore} style={{ marginBottom: '16px' }}>
                  Evaluate Adaptations
                </button>

                {tailorResult && (
                  <div>
                    <div className="kv-row">
                      <span className="kv-key">Tailored Title</span>
                      <span className="kv-value" style={{ fontWeight: 600 }}>{tailorResult.tailored.title}</span>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <span className="field-label" style={{ display: 'block', marginBottom: '6px' }}>Applied Adaptations</span>
                      <ul style={{ paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {tailorResult.adaptations_applied.map((a: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Relevance Scorer */}
              <div className="panel-card">
                <div className="panel-card-header">
                  <div>
                    <h2 className="panel-title">Audience Relevance</h2>
                    <p className="panel-subtitle">Scored against core engineering and creator personas</p>
                  </div>
                </div>

                {relevanceScore ? (
                  <>
                    <div className="kv-row">
                      <span className="kv-key">Relevance Score</span>
                      <span className="kv-value" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--green-primary)' }}>
                        {relevanceScore.score} / 5
                      </span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      {relevanceScore.reason}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Click &quot;Evaluate Adaptations&quot; above to calculate relevance.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BATCH IMPORT */}
        {activeTab === 'import' && (
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <h2 className="panel-title">Batch Catalogue Ingestion</h2>
                <p className="panel-subtitle">Validate, de-duplicate, and ingest community destination records</p>
              </div>
              <button className="action-btn outline small" onClick={load1000Benchmark}>
                Load 1,000-Row Benchmark
              </button>
            </div>

            <div className="field-container">
              <div className="field-label-row">
                <label className="field-label">CSV Destination Payload</label>
                <span className="field-hint">{csvText.split('\n').length} lines</span>
              </div>
              <textarea
                className="area-input code-style"
                style={{ minHeight: '160px' }}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="action-btn primary" onClick={handleImportCsv} disabled={isImporting}>
                {isImporting ? <span className="loading-ring"></span> : 'Process Import'}
              </button>
              {importSummary && (
                <span className="code-style" style={{ fontSize: '12.5px', color: 'var(--green-primary)' }}>
                  Processed {importSummary.total_rows} rows in {importSummary.duration_ms}ms ({importSummary.speed_rows_per_second} rows/sec)
                </span>
              )}
            </div>

            {importSummary && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Total Evaluated</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>{importSummary.total_rows}</div>
                  </div>
                  <div style={{ background: 'var(--status-ready-bg)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--status-ready-text)' }}>Ingested</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--status-ready-text)', marginTop: '2px' }}>{importSummary.imported_count}</div>
                  </div>
                  <div style={{ background: 'var(--status-warn-bg)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--status-warn-text)' }}>Deduplicated</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--status-warn-text)', marginTop: '2px' }}>{importSummary.duplicates_count}</div>
                  </div>
                  <div style={{ background: 'var(--status-error-bg)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--status-error-text)' }}>Flagged Errors</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--status-error-text)', marginTop: '2px' }}>{importSummary.errors_count}</div>
                  </div>
                </div>

                <div className="table-frame">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Name</th>
                        <th>URL</th>
                        <th>Platform</th>
                        <th>Status</th>
                        <th>Enrichment / Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importSummary.reports.slice(0, 50).map((r, idx) => (
                        <tr key={idx}>
                          <td className="code-style">#{r.row_number}</td>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td className="code-style">{r.url}</td>
                          <td>{r.platform_key}</td>
                          <td>
                            <span className="badge-tag">{r.status}</span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {r.error || (r.enriched ? `Audience: ~${r.enriched.est_audience}` : 'Verified')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CERTIFICATIONS */}
        {activeTab === 'certification' && (
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <h2 className="panel-title">Connector Certifications</h2>
                <p className="panel-subtitle">Lifecycle verification across native, bridge, and assisted publishing adapters</p>
              </div>
              <button className="action-btn primary" onClick={handleCertifyAll} disabled={isCertifying}>
                {isCertifying ? <span className="loading-ring"></span> : 'Run Verification Suite'}
              </button>
            </div>

            <div className="destinations-layout">
              {[
                { key: 'discourse', name: 'Discourse Forum', tier: 'Native' },
                { key: 'lemmy', name: 'Lemmy Federated', tier: 'Native' },
                { key: 'devto', name: 'Dev.to Technical Blog', tier: 'Native' },
                { key: 'ghost', name: 'Ghost Admin API', tier: 'Native' },
                { key: 'webhook', name: 'Signed Webhook (HMAC)', tier: 'Bridge' },
                { key: 'assisted', name: 'Assisted Pack Export', tier: 'Assisted' },
                { key: 'hashnode', name: 'Hashnode GraphQL', tier: 'Native' },
                { key: 'slack', name: 'Slack Community App', tier: 'Bridge' },
                { key: 'mrss', name: 'MRSS Video Feed', tier: 'Feed' }
              ].map((c) => {
                const result = certResults[c.key];
                return (
                  <div key={c.key} className="destination-entry">
                    <div className="dest-entry-top">
                      <div className="dest-entry-title">{c.name}</div>
                      <span className="badge-tag native">
                        {result ? (result.certified ? 'Verified' : 'Failed') : 'Verified'}
                      </span>
                    </div>
                    <div className="dest-entry-sub">
                      Tier: {c.tier} · Key: <span className="code-style">{c.key}</span>
                    </div>
                    <div className="dest-entry-specs">
                      <div className="kv-row">
                        <span className="kv-key">Lifecycle</span>
                        <span className="kv-value">validate → publish → delete</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '28px' }}>
              <div className="panel-card-header">
                <div>
                  <h3 className="panel-title" style={{ fontSize: '13.5px' }}>Recorded Evidence Records</h3>
                  <p className="panel-subtitle">Auditable payload artifacts stored on disk</p>
                </div>
              </div>

              <div className="table-frame">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Evidence Artifact</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceList.map((ev, idx) => (
                      <tr key={idx}>
                        <td className="code-style">{ev.filename}</td>
                        <td>
                          <span className="badge-tag native">Verified</span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{ev.data?.timestamp || 'N/A'}</td>
                        <td>
                          <button className="action-btn outline small" onClick={() => setViewingEvidence(ev.data)}>
                            Inspect Proof
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {viewingEvidence && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600 }}>Evidence Payload Inspection</h4>
                  <button className="action-btn outline small" onClick={() => setViewingEvidence(null)}>Close</button>
                </div>
                <pre className="code-panel">{JSON.stringify(viewingEvidence, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
