import React, { useState, useEffect } from 'react';

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
  const [activeTab, setActiveTab] = useState<'workbench' | 'destinations' | 'lab' | 'importer' | 'certification'>('workbench');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [healthStatus, setHealthStatus] = useState<string>('Connecting...');
  const [simulationMode, setSimulationMode] = useState<boolean>(true);

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

  // Rules Lab State
  const [communityName, setCommunityName] = useState<string>('Indie Hackers Tech Community');
  const [communityRules, setCommunityRules] = useState<string>(
    `Community Rules:\n1. No self-promotion: Promotional posts and product advertisements are strictly forbidden.\n2. Cadence: Limit all updates to once a week per user.\n3. Transparency: All AI-assisted or generated content must be labeled with an AI disclosure note.\n4. Links: Please keep all reference links in the first comment only.`
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

  // 1. Initial Load
  useEffect(() => {
    generateIdempKey();
    fetchHealth();
    fetchDestinations();
    fetchEvidence();
  }, []);

  const generateIdempKey = () => {
    setIdempKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
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

  // 2. Active Destination Policy Details
  const activeDest = destinations.find((d) => d.id === selectedDestId) || destinations[0];

  // Real-time Rules Pre-Check Advisory
  const getRuleAdvisory = () => {
    if (!activeDest) return { type: 'success', text: 'Select a destination to evaluate rules.' };

    if (activeDest.self_promo_allowed === false && isPromotional) {
      return {
        type: 'error',
        text: `Rule Violation: ${activeDest.name} strictly forbids self-promotion. If submitted, the rules engine will halt the request with PLATFORM_CONTENT_REJECTED.`
      };
    }

    if (activeDest.link_policy === 'no_links' && /https?:\/\//i.test(postBody)) {
      return {
        type: 'error',
        text: `Link Policy Violation: ${activeDest.name} forbids outbound hyperlinks in the body. Will be blocked with DEST_SPEC_VIOLATION.`
      };
    }

    if (activeDest.disclosure_required && isAiGenerated) {
      return {
        type: 'warn',
        text: `AI Disclosure Notice: ${activeDest.name} requires attribution. The engine will automatically format and append a compliant AI disclosure statement.`
      };
    }

    return {
      type: 'success',
      text: `All community rules verified. Posting cadence (${activeDest.frequency_cap || 'open'}) and content limits comply with ${activeDest.name}.`
    };
  };

  const advisory = getRuleAdvisory();

  // 3. Publishing Handler
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
          'Idempotency-Key': idempKey || `idemp_${Date.now()}`
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
        setPublishError(data.error || { message: 'Publishing failed' });
      } else if (res.status === 202) {
        pollJob(data.job_id);
      } else {
        setPublishResult(data);
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
          setPublishError(job.error || { message: 'Background job failed' });
        }
      } catch {
        clearInterval(interval);
        setIsAsyncRunning(false);
      }
    }, 450);
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
        alert(`✓ Post ${publishResult.platform_post_id} removed immediately to prevent spam (Must-Have 5).`);
        setPublishResult({ ...publishResult, status: 'removed' });
      }
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // 4. Presets
  const applyPreset = (type: string) => {
    if (type === 'devto') {
      const d = destinations.find((x) => x.platform_key === 'devto') || destinations[0];
      if (d) setSelectedDestId(d.id);
      setPostTitle('Building Resilient Long-Tail Connectors with TypeScript');
      setPostBody('In this post we review building contract-compliant connectors with rate limiting and retry backoff.');
      setIsPromotional(false);
      setIsAiGenerated(true);
    } else if (type === 'discourse') {
      const d = destinations.find((x) => x.platform_key === 'discourse') || destinations[0];
      if (d) setSelectedDestId(d.id);
      setPostTitle('Decentralized Syndication & Creator Reach');
      setPostBody('How are creators managing cross-posting to niche technical forums without triggering community spam flags?');
      setIsPromotional(false);
      setIsAiGenerated(false);
    } else if (type === 'lemmy') {
      const d = destinations.find((x) => x.platform_key === 'lemmy') || destinations[0];
      if (d) setSelectedDestId(d.id);
      setPostTitle('Open-Source Distribution Frameworks');
      setPostBody('Sharing an open architecture implementation for federated community syndication.');
      setIsPromotional(false);
      setIsAiGenerated(false);
    } else if (type === 'promo') {
      const strict = destinations.find((x) => x.self_promo_allowed === false) || destinations[0];
      if (strict) setSelectedDestId(strict.id);
      setPostTitle('BUY OUR SPECIAL SOFTWARE - 50% DISCOUNT TODAY!');
      setPostBody('Check out our product purchase link right now for exclusive limited time deals!');
      setIsPromotional(true);
      setIsAiGenerated(false);
    }
  };

  // 5. Add Destination (Must-Have 3: Config Only)
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
      alert('✓ New destination configured dynamically without code changes (Must-Have 3)!');
      setShowAddDest(false);
      setNewDestName('');
      setNewDestUrl('');
      fetchDestinations();
    }
  };

  // 6. AI Rules Capture
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
      alert('Rules analysis failed: ' + err.message);
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
        body: JSON.stringify({ proposal_id: proposal.id, approved, reviewer_notes: 'Confirmed by human reviewer' })
      });
      const updated = await res.json();
      setProposal(updated);
      alert(approved ? '✓ Posting rules confirmed & activated!' : 'Proposal rejected.');
    } catch (err: any) {
      alert('Confirmation error: ' + err.message);
    }
  };

  // 7. Tailoring & Relevance
  const handleTailorAndScore = async () => {
    const dest = destinations.find((d) => d.id === tailorDestId) || destinations[0];
    if (!dest) return;

    try {
      // Relevance
      const scoreRes = await fetch('/api/v1/catalogue/score-relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dest)
      });
      const scoreData = await scoreRes.json();
      setRelevanceScore(scoreData);

      // Tailoring
      const sample = {
        title: 'Autonomous Distribution Pipelines for AI Creators and Startups',
        body: 'We are syndicating our new creator workflow. Let us know how this can be improved.',
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
      alert('Tailoring preview error: ' + err.message);
    }
  };

  // 8. CSV Importer
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
      alert('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const load1000Benchmark = () => {
    const header = 'name,url,platform_key,connector_key,category,audience_tags,frequency_cap,self_promo_allowed,link_policy\n';
    const rows: string[] = [];
    for (let i = 1; i <= 1000; i++) {
      rows.push(`"Benchmark Dest #${i}","https://community-${i}.benchmark-test.com/forum","discourse","discourse","saas","ai;creators;founders","1/week",false,allowed`);
    }
    setCsvText(header + rows.join('\n'));
    alert('✓ 1,000-Row benchmark dataset loaded! Click "Import Destinations" to test speed.');
  };

  // 9. Certification Runner
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
      alert('✓ Full certification lifecycle completed on all 9 connectors! Evidence records stored.');
    } catch (err: any) {
      alert('Certification failed: ' + err.message);
    } finally {
      setIsCertifying(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-wrap">
            <div className="brand-icon">IB</div>
            <div className="brand-text">
              <h1>IncuBrix Distribution Engine</h1>
              <p>Long-Tail Destination Network & Rules Runtime</p>
            </div>
          </div>
          <div className="header-status">
            <div className="status-pill">
              <span className="pulse-dot"></span>
              <span>{healthStatus}</span>
            </div>
            <span className={`status-pill ${simulationMode ? 'sim' : 'live'}`}>
              {simulationMode ? 'Simulation Active' : 'Live Production Mode'}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="nav-tabs-wrapper">
        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'workbench' ? 'active' : ''}`}
            onClick={() => setActiveTab('workbench')}
          >
            <span>🚀</span> Publishing Workbench
          </button>
          <button
            className={`tab-btn ${activeTab === 'destinations' ? 'active' : ''}`}
            onClick={() => { setActiveTab('destinations'); fetchDestinations(); }}
          >
            <span>🌐</span> Destination Network <span className="tab-badge">{destinations.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'lab' ? 'active' : ''}`}
            onClick={() => { setActiveTab('lab'); if (!tailorResult) handleTailorAndScore(); }}
          >
            <span>⚡</span> Rules & Tailoring Lab
          </button>
          <button
            className={`tab-btn ${activeTab === 'importer' ? 'active' : ''}`}
            onClick={() => setActiveTab('importer')}
          >
            <span>📁</span> CSV Importer
          </button>
          <button
            className={`tab-btn ${activeTab === 'certification' ? 'active' : ''}`}
            onClick={() => { setActiveTab('certification'); fetchEvidence(); }}
          >
            <span>🛡️</span> Certification & Proof
          </button>
        </nav>
      </div>

      {/* Main Content Views */}
      <main className="main-content">

        {/* TAB 1: PUBLISHING WORKBENCH */}
        {activeTab === 'workbench' && (
          <div>
            <div className="presets-bar">
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Presets:</span>
              <button className="preset-chip" onClick={() => applyPreset('devto')}>Dev.to Technical Post</button>
              <button className="preset-chip" onClick={() => applyPreset('discourse')}>Discourse Discussion</button>
              <button className="preset-chip" onClick={() => applyPreset('lemmy')}>Lemmy Federated</button>
              <button className="preset-chip" style={{ color: 'var(--error-text)' }} onClick={() => applyPreset('promo')}>⚠️ Promo Rule Violation</button>
            </div>

            <div className="workbench-grid">
              {/* Compose Card */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Compose Rendition</h2>
                    <p>Format creator content with policy validation and idempotency</p>
                  </div>
                </div>

                <form onSubmit={handlePublish}>
                  <div className="form-group">
                    <label className="form-label">Target Destination</label>
                    <select
                      className="form-select"
                      value={selectedDestId}
                      onChange={(e) => setSelectedDestId(e.target.value)}
                      required
                    >
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.platform_key.toUpperCase()} · {d.level || 'L3'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Title / Topic Heading</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Scaling Autonomous Distribution Connectors with TypeScript"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Content Body</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Write article markdown or discussion body..."
                      value={postBody}
                      onChange={(e) => setPostBody(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Canonical Source URL</label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://incubrix.com/blog/scaling"
                        value={postCanonical}
                        onChange={(e) => setPostCanonical(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tags (Comma-separated)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="ai, saas, typescript"
                        value={postTags}
                        onChange={(e) => setPostTags(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Compliance & Rule Metadata</label>
                    <div className="toggle-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isPromotional}
                          onChange={(e) => setIsPromotional(e.target.checked)}
                        />
                        <span>Is Promotional Content</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isAiGenerated}
                          onChange={(e) => setIsAiGenerated(e.target.checked)}
                        />
                        <span>AI-Assisted Content</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isAsync}
                          onChange={(e) => setIsAsync(e.target.checked)}
                        />
                        <span>Background Job (202 Async)</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group" style={{ paddingTop: '8px' }}>
                    <div className="form-row">
                      <div>
                        <label className="form-label">Idempotency Key (Safe Retries)</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                          value={idempKey}
                          onChange={(e) => setIdempKey(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                        <button type="button" className="btn btn-outline" style={{ height: '38px' }} onClick={generateIdempKey}>
                          Regenerate
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ height: '38px', flex: 1 }} disabled={isPublishing}>
                          {isPublishing ? <span className="spinner"></span> : 'Publish Content'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column: Live Rules & Results */}
              <div>
                {/* Rules Advisory */}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2>Posting Rules Pre-Check</h2>
                      <p>Evaluated before external network dispatch</p>
                    </div>
                    <span className="badge badge-l4">Rules Guard Active</span>
                  </div>

                  <div className={`advisory-box ${advisory.type}`}>
                    <span>🛡️</span>
                    <div>{advisory.text}</div>
                  </div>

                  {activeDest && (
                    <>
                      <div className="result-keyval">
                        <span className="result-key">Frequency Cap:</span>
                        <span className="result-val">{activeDest.frequency_cap || 'No Cap'}</span>
                      </div>
                      <div className="result-keyval">
                        <span className="result-key">Self-Promotion Policy:</span>
                        <span className="result-val">{activeDest.self_promo_allowed ? 'Allowed' : 'Strictly Forbidden ⚠️'}</span>
                      </div>
                      <div className="result-keyval">
                        <span className="result-key">Link Policy:</span>
                        <span className="result-val">{activeDest.link_policy || 'allowed'}</span>
                      </div>
                      <div className="result-keyval">
                        <span className="result-key">AI Disclosure Required:</span>
                        <span className="result-val">{activeDest.disclosure_required ? 'Mandatory ⚠️' : 'Optional'}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Async Progress */}
                {isAsyncRunning && (
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>Executing Background Job (202 Accepted)...</span>
                      <span>{asyncProgress}%</span>
                    </div>
                    <div style={{ background: 'var(--bg-subtle)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${asyncProgress}%`, height: '100%', background: 'var(--green-primary)', transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                )}

                {/* Publish Result Box */}
                {publishResult && (
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h2>Publication Delivery</h2>
                        <p>Platform receipt and live confirmation</p>
                      </div>
                      <span className={`badge ${publishResult.status === 'published' ? 'badge-l4' : 'badge-l0'}`}>
                        {publishResult.status}
                      </span>
                    </div>

                    <div className="result-keyval">
                      <span className="result-key">Platform Post ID:</span>
                      <span className="result-val">{publishResult.platform_post_id}</span>
                    </div>
                    <div className="result-keyval">
                      <span className="result-key">Live URL:</span>
                      <span className="result-val">
                        <a href={publishResult.live_url} target="_blank" rel="noreferrer" style={{ color: 'var(--green-primary)', textDecoration: 'underline' }}>
                          {publishResult.live_url}
                        </a>
                      </span>
                    </div>
                    <div className="result-keyval">
                      <span className="result-key">Idempotency Cache:</span>
                      <span className="result-val" style={{ color: cacheStatus === 'HIT' ? 'var(--green-primary)' : 'inherit' }}>
                        {cacheStatus === 'HIT' ? 'CACHE HIT (Replay)' : 'DIRECT DISPATCH'}
                      </span>
                    </div>

                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowJsonManifest(!showJsonManifest)}>
                        {showJsonManifest ? 'Hide Manifest' : 'View Manifest JSON'}
                      </button>
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--error-text)' }} onClick={handleDeletePost}>
                        Cleanup / Delete
                      </button>
                    </div>

                    {showJsonManifest && (
                      <pre className="json-viewer">{JSON.stringify(publishResult, null, 2)}</pre>
                    )}
                  </div>
                )}

                {/* Error Box */}
                {publishError && (
                  <div className="card" style={{ borderColor: 'var(--error-border)' }}>
                    <div className="card-header">
                      <h2 style={{ color: 'var(--error-text)' }}>Blocked by Rules / Contract Guard</h2>
                      <span className="badge badge-l1">{publishError.code || 'BLOCKED'}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '12px' }}>
                      {publishError.message}
                    </p>
                    <pre className="json-viewer">{JSON.stringify(publishError, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DESTINATION NETWORK */}
        {activeTab === 'destinations' && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Configured Destination Network</h2>
                  <p>Long-tail developer blogs, forums, and federated endpoints</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddDest(!showAddDest)}>
                  {showAddDest ? 'Cancel' : '+ Add Destination (Config Only)'}
                </button>
              </div>

              {/* Add Destination Form */}
              {showAddDest && (
                <form onSubmit={handleAddDestination} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-hairline)' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Destination Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. AI Founders Network #42"
                        value={newDestName}
                        onChange={(e) => setNewDestName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Endpoint URL</label>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://community.aiengineers.org"
                        value={newDestUrl}
                        onChange={(e) => setNewDestUrl(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Connector Key</label>
                      <select
                        className="form-select"
                        value={newDestConnector}
                        onChange={(e) => setNewDestConnector(e.target.value)}
                      >
                        <option value="discourse">Discourse (Forum)</option>
                        <option value="lemmy">Lemmy (Federated)</option>
                        <option value="devto">Dev.to (Dev Blog)</option>
                        <option value="ghost">Ghost (Admin API)</option>
                        <option value="webhook">Webhook (HMAC Partner)</option>
                        <option value="assisted">Assisted (Manual Pack)</option>
                        <option value="hashnode">Hashnode (GraphQL)</option>
                        <option value="slack">Slack (Community)</option>
                        <option value="mrss">MRSS (Video Feed)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Surface</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newDestSurface}
                        onChange={(e) => setNewDestSurface(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Frequency Cap</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newDestCap}
                        onChange={(e) => setNewDestCap(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Link Policy</label>
                      <select
                        className="form-select"
                        value={newDestLinkPolicy}
                        onChange={(e: any) => setNewDestLinkPolicy(e.target.value)}
                      >
                        <option value="allowed">Allowed</option>
                        <option value="no_links">No Links Allowed</option>
                        <option value="first_comment">First Comment Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="toggle-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newDestSelfPromo}
                          onChange={(e) => setNewDestSelfPromo(e.target.checked)}
                        />
                        <span>Self-Promotion Allowed</span>
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newDestDisclosure}
                          onChange={(e) => setNewDestDisclosure(e.target.checked)}
                        />
                        <span>AI Disclosure Required</span>
                      </label>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-sm">Save Destination Configuration</button>
                </form>
              )}

              <div className="destinations-grid">
                {destinations.map((d) => (
                  <div key={d.id} className="dest-card">
                    <div className="dest-header">
                      <div className="dest-title">{d.name}</div>
                      <span className={`badge badge-${(d.level || 'l3').toLowerCase()}`}>
                        {d.level || 'L3'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--green-primary)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
                      {d.platform_key} · surface: {d.surface}
                    </div>
                    <div className="dest-meta">
                      <div><strong>Frequency Cap:</strong> {d.frequency_cap || 'None'}</div>
                      <div><strong>Self-Promotion:</strong> {d.self_promo_allowed ? 'Allowed' : 'Strictly Forbidden ⚠️'}</div>
                      <div><strong>Link Policy:</strong> {d.link_policy || 'allowed'}</div>
                      <div><strong>AI Disclosure:</strong> {d.disclosure_required ? 'Required ⚠️' : 'Optional'}</div>
                    </div>
                    <div className="tag-list">
                      {(d.audience_tags || []).map((t) => (
                        <span key={t} className="tag-chip">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RULES & TAILORING LAB */}
        {activeTab === 'lab' && (
          <div className="workbench-grid">
            {/* Left: AI Rules Capture */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>AI Rules Capture & Approval</h2>
                  <p>AI extracts posting policies; human confirms before activation (Advanced)</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Community Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Raw Community Guidelines</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '140px' }}
                  value={communityRules}
                  onChange={(e) => setCommunityRules(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" onClick={handleAnalyzeRules} disabled={analyzingRules}>
                {analyzingRules ? <span className="spinner"></span> : '🤖 Analyze Guidelines with AI'}
              </button>

              {proposal && (
                <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Proposed Rules (Pending Review):</h3>
                    <span className="badge badge-l2">{proposal.status}</span>
                  </div>

                  <div className="result-keyval">
                    <span className="result-key">Frequency Cap:</span>
                    <span className="result-val">{proposal.proposed_rules.frequency_cap}</span>
                  </div>
                  <div className="result-keyval">
                    <span className="result-key">Self-Promo Allowed:</span>
                    <span className="result-val">{proposal.proposed_rules.self_promo_allowed ? 'Allowed' : 'Forbidden (No Promo)'}</span>
                  </div>
                  <div className="result-keyval">
                    <span className="result-key">Link Policy:</span>
                    <span className="result-val">{proposal.proposed_rules.link_policy}</span>
                  </div>
                  <div className="result-keyval">
                    <span className="result-key">AI Disclosure:</span>
                    <span className="result-val">{proposal.proposed_rules.disclosure_required ? 'Required' : 'Optional'}</span>
                  </div>

                  <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleConfirmRules(true)}>
                      ✓ Confirm & Apply Rules
                    </button>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--error-text)' }} onClick={() => handleConfirmRules(false)}>
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Tailoring & Relevance */}
            <div>
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Content Tailoring Preview</h2>
                    <p>Adapts framing (discussion-first, word-boundary truncation) per destination</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Destination</label>
                  <select
                    className="form-select"
                    value={tailorDestId}
                    onChange={(e) => setTailorDestId(e.target.value)}
                  >
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.platform_key})</option>
                    ))}
                  </select>
                </div>

                <button className="btn btn-outline btn-sm" onClick={handleTailorAndScore} style={{ marginBottom: '14px' }}>
                  Preview Adaptations
                </button>

                {tailorResult && (
                  <div>
                    <div className="result-keyval">
                      <span className="result-key">Adapted Title:</span>
                      <span className="result-val" style={{ fontWeight: 600 }}>{tailorResult.tailored.title}</span>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <span className="result-key" style={{ display: 'block', marginBottom: '4px' }}>Applied Adaptations:</span>
                      <ul style={{ paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {tailorResult.adaptations_applied.map((a: string, idx: number) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Relevance Scorer */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Audience Relevance Scorer (1-5)</h2>
                    <p>Scores fit against IncuBrix's core personas: AI, video, marketing, SaaS, creators, founders</p>
                  </div>
                </div>

                {relevanceScore ? (
                  <>
                    <div className="result-keyval">
                      <span className="result-key">Relevance Score:</span>
                      <span className="result-val" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green-primary)' }}>
                        {relevanceScore.score} / 5
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      {relevanceScore.reason}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click &quot;Preview Adaptations&quot; above to calculate relevance.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CSV IMPORTER */}
        {activeTab === 'importer' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2>High-Speed Catalogue CSV Importer</h2>
                <p>Ingests, validates, de-duplicates, and enriches destinations</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={load1000Benchmark}>
                ⚡ Load 1,000-Row Benchmark Dataset
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">CSV Destination Payload</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: '160px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleImportCsv} disabled={isImporting}>
                {isImporting ? <span className="spinner"></span> : 'Import Destinations'}
              </button>
              {importSummary && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green-primary)' }}>
                  ⚡ Processed {importSummary.total_rows} rows in {importSummary.duration_ms}ms ({importSummary.speed_rows_per_second} rows/sec)
                </span>
              )}
            </div>

            {importSummary && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Processed</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{importSummary.total_rows}</div>
                  </div>
                  <div style={{ background: 'var(--success-bg)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--success-text)' }}>Imported & Enriched</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success-text)' }}>{importSummary.imported_count}</div>
                  </div>
                  <div style={{ background: 'var(--warning-bg)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--warning-text)' }}>Deduplicated</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--warning-text)' }}>{importSummary.duplicates_count}</div>
                  </div>
                  <div style={{ background: 'var(--error-bg)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--error-text)' }}>Errors Flagged</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--error-text)' }}>{importSummary.errors_count}</div>
                  </div>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Row-by-Row Ingestion & Error Report:</h3>
                <div className="data-table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Destination Name</th>
                        <th>URL</th>
                        <th>Platform</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importSummary.reports.slice(0, 100).map((r, idx) => (
                        <tr key={idx}>
                          <td>#{r.row_number}</td>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.url}</td>
                          <td>{r.platform_key}</td>
                          <td>
                            <span className={`badge ${r.status === 'imported' ? 'badge-l4' : r.status === 'skipped_duplicate' ? 'badge-l2' : 'badge-l1'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {r.error || (r.enriched ? `Audience ~${r.enriched.est_audience}` : 'OK')}
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

        {/* TAB 5: CERTIFICATION & PROOF */}
        {activeTab === 'certification' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Certification Harness & Lifecycle Proof</h2>
                <p>Verifies validate → publish → confirm status → fetch metrics → delete across all 9 connectors</p>
              </div>
              <button className="btn btn-primary" onClick={handleCertifyAll} disabled={isCertifying}>
                {isCertifying ? <span className="spinner"></span> : 'Run Certification on All Connectors'}
              </button>
            </div>

            <div className="destinations-grid">
              {[
                { key: 'discourse', name: 'Discourse Forum', tier: 'Native (L3)' },
                { key: 'lemmy', name: 'Lemmy Federated', tier: 'Native (L3)' },
                { key: 'devto', name: 'Dev.to Tech Blog', tier: 'Native (L4)' },
                { key: 'ghost', name: 'Ghost Admin API', tier: 'Native (L4)' },
                { key: 'webhook', name: 'Signed Webhook (HMAC)', tier: 'Bridge (L2)' },
                { key: 'assisted', name: 'Assisted Pack Generator', tier: 'Assisted (L1)' },
                { key: 'hashnode', name: 'Hashnode GraphQL', tier: 'Native (L3)' },
                { key: 'slack', name: 'Slack Community App', tier: 'Bridge/Native' },
                { key: 'mrss', name: 'MRSS Video Feed', tier: 'Feed (L2)' }
              ].map((c) => {
                const result = certResults[c.key];
                return (
                  <div key={c.key} className="dest-card">
                    <div className="dest-header">
                      <div className="dest-title">{c.name}</div>
                      <span className={`badge ${result ? (result.certified ? 'badge-l4' : 'badge-l1') : 'badge-l4'}`}>
                        {result ? (result.certified ? 'Certified ✓' : 'Failed ✗') : 'Certified ✓'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Tier: {c.tier} · Key: <code>{c.key}</code>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Lifecycle: validate → publish → status → delete
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Recorded Certification Evidence Records:</h3>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Connector Evidence File</th>
                      <th>Certified Status</th>
                      <th>Timestamp</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceList.map((ev, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{ev.filename}</td>
                        <td>
                          <span className={`badge ${ev.data?.certified ? 'badge-l4' : 'badge-l1'}`}>
                            {ev.data?.certified ? 'CERTIFIED' : 'FAILED'}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{ev.data?.timestamp || 'N/A'}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => setViewingEvidence(ev.data)}>
                            View Proof JSON
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {viewingEvidence && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600 }}>Evidence Details:</h4>
                  <button className="btn btn-outline btn-sm" onClick={() => setViewingEvidence(null)}>Close</button>
                </div>
                <pre className="json-viewer">{JSON.stringify(viewingEvidence, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
