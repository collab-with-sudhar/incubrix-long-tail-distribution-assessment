import { Router, Request, Response } from 'express';
import crypto from 'crypto';

export const mockRouter = Router();

interface MockPostRecord {
  id: string;
  title: string;
  body: string;
  platform: string;
  createdAt: string;
  url: string;
  status: string;
  tags?: string[];
  score?: string;
}

const mockPostsStore = new Map<string, MockPostRecord>();

function escapeHtml(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderHtmlPreview(opts: {
  badge: string;
  platform: string;
  title: string;
  bodyHtml: string;
  postId: string;
  urlPath: string;
  timestamp: string;
  tags?: string[];
  category?: string;
  score?: string;
}): string {
  const tagsHtml = (opts.tags || ['distribution', 'tech'])
    .map(t => `<span class="tag">#${escapeHtml(t)}</span>`)
    .join(' ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.title)} — ${escapeHtml(opts.platform)} | IncuBrix</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&family=Google+Sans+Text:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-page: #F7FAF8;
      --bg-surface: #FFFFFF;
      --border-hairline: #E1EAE3;
      --border-subtle: #D2DFD5;
      --green-primary: #245E3D;
      --green-light: #EAF5EE;
      --green-border: #BCDDC7;
      --text-main: #141C16;
      --text-secondary: #4F5E53;
      --text-muted: #7A8B7F;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Google Sans Text', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      padding: 32px 16px;
      line-height: 1.6;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-hairline);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Google Sans', sans-serif;
      font-weight: 600;
      font-size: 15px;
      color: var(--text-main);
      text-decoration: none;
    }
    .brand-dot {
      width: 10px;
      height: 10px;
      background: #245E3D;
      border-radius: 50%;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--green-light);
      color: var(--green-primary);
      border: 1px solid var(--green-border);
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 999px;
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: 12px;
      padding: 36px 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(20,28,22,0.03);
    }
    .platform-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .platform-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .article-title {
      font-family: 'Google Sans', sans-serif;
      font-size: 26px;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.3;
      margin-bottom: 16px;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-hairline);
    }
    .article-body {
      font-size: 15px;
      color: var(--text-main);
      line-height: 1.7;
      margin-bottom: 32px;
    }
    .article-body p { margin-bottom: 14px; }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 28px;
    }
    .tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: var(--bg-page);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      padding: 3px 8px;
      border-radius: 4px;
    }
    .metadata-grid {
      background: #F9FBFA;
      border: 1px solid var(--border-hairline);
      border-radius: 8px;
      padding: 16px 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      font-size: 12px;
      margin-bottom: 28px;
    }
    .metadata-item span:first-child {
      display: block;
      color: var(--text-muted);
      font-weight: 500;
      margin-bottom: 2px;
    }
    .metadata-item span:last-child {
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-main);
    }
    .action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid var(--border-hairline);
    }
    .btn-return {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--green-primary);
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      padding: 10px 18px;
      border-radius: 6px;
      transition: background 0.15s ease;
    }
    .btn-return:hover {
      background: #1B492F;
    }
    .status-ok {
      color: #1C5432;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .status-ok::before {
      content: "●";
      color: #245E3D;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <a href="http://localhost:3000" class="brand">
        <span class="brand-dot"></span>
        IncuBrix Distribution Network
      </a>
      <span class="badge">
        <span class="status-ok"></span>
        ${escapeHtml(opts.badge)}
      </span>
    </div>

    <div class="card">
      <div class="platform-header">
        <span class="platform-name">${escapeHtml(opts.platform)} Destination Sandbox</span>
        <span class="badge" style="background:#FFFFFF; font-family:'JetBrains Mono', monospace;">HTTP 200 OK</span>
      </div>

      <h1 class="article-title">${escapeHtml(opts.title)}</h1>

      <div class="meta-bar">
        <span>Published on: ${new Date(opts.timestamp).toLocaleString()}</span>
        <span>•</span>
        <span>Destination Surface: ${escapeHtml(opts.platform)}</span>
        <span>•</span>
        <span class="status-ok">Live & Verified</span>
      </div>

      <div class="article-body">
        ${opts.bodyHtml}
      </div>

      ${opts.tags && opts.tags.length > 0 ? `<div class="tags">${tagsHtml}</div>` : ''}

      <div class="metadata-grid">
        <div class="metadata-item">
          <span>Platform Post ID</span>
          <span>${escapeHtml(opts.postId)}</span>
        </div>
        <div class="metadata-item">
          <span>Verification Status</span>
          <span>200 Published / Clean</span>
        </div>
        <div class="metadata-item">
          <span>Rules Compliance</span>
          <span>100% Passed</span>
        </div>
        <div class="metadata-item">
          <span>Relevance Score</span>
          <span>${escapeHtml(opts.score || '4 / 5')}</span>
        </div>
      </div>

      <div class="action-row">
        <span style="font-size: 13px; color: var(--text-muted);">
          IncuBrix Certified Destination • Appendix A Contract
        </span>
        <a href="http://localhost:3000" class="btn-return">
          ← Back to Console
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Discourse Forum Mock Server
 */
mockRouter.post('/discourse/posts.json', (req: Request, res: Response) => {
  const id = Math.floor(1000 + Math.random() * 9000);
  const topicId = Math.floor(100 + Math.random() * 900);
  const title = req.body.title || 'IncuBrix Community Discussion';
  const raw = req.body.raw || 'Discussion content published via IncuBrix.';
  const topicSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'community-discussion';

  const record: MockPostRecord = {
    id: String(id),
    title,
    body: raw,
    platform: 'Discourse Forum',
    createdAt: new Date().toISOString(),
    url: `http://localhost:3000/mock/discourse/t/${topicSlug}/${id}`,
    status: 'published',
    tags: ['saas', 'developers', 'community'],
    score: '4 / 5'
  };

  mockPostsStore.set(String(id), record);
  mockPostsStore.set(String(topicId), record);
  mockPostsStore.set(topicSlug, record);
  mockPostsStore.set(`${topicSlug}-${id}`, record);

  res.status(200).json({
    id,
    topic_id: topicId,
    topic_slug: topicSlug,
    raw,
    title
  });
});

mockRouter.get('/discourse/posts/:id.json', (req: Request, res: Response) => {
  res.status(200).json({
    id: req.params.id,
    reads: 84,
    score: 18,
    post_number: 1
  });
});

mockRouter.delete('/discourse/posts/:id.json', (req: Request, res: Response) => {
  mockPostsStore.delete(req.params.id);
  res.status(200).json({ success: 'OK' });
});

mockRouter.get(['/discourse/t/:slug/:id', '/discourse/t/:id'], (req: Request, res: Response) => {
  const { slug, id } = req.params;
  const post = mockPostsStore.get(id) || mockPostsStore.get(slug || '') || mockPostsStore.get(`${slug}-${id}`) || {
    id: id || '1001',
    title: slug ? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Discourse Forum Discussion',
    body: 'Automated discussion topic published via IncuBrix Distribution Network. Certified against forum posting rules and frequency limits.',
    platform: 'Discourse Forum',
    createdAt: new Date().toISOString(),
    url: `/mock/discourse/t/${slug || 'topic'}/${id || '1001'}`,
    status: 'published'
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Discourse Forum • Discussion Topic',
    platform: 'Discourse',
    title: post.title,
    bodyHtml: `<div style="white-space: pre-wrap; font-size: 15px;">${escapeHtml(post.body)}</div>`,
    postId: `topic_${post.id}`,
    urlPath: `/mock/discourse/t/${slug || 'topic'}/${id}`,
    timestamp: post.createdAt,
    tags: ['saas', 'developers', 'community'],
    score: '4 / 5'
  }));
});

mockRouter.get('/discourse/guidelines', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Discourse Guidelines',
    platform: 'Discourse Guidelines',
    title: 'Discourse Community Posting Guidelines',
    bodyHtml: `<h3>Posting Rules & Policy:</h3>
      <ul>
        <li><strong>Frequency Cap:</strong> Maximum 10 posts per day.</li>
        <li><strong>Self-Promotion:</strong> Strictly prohibited. Focus on community value and constructive discussions.</li>
        <li><strong>Links:</strong> Allowed with context. No link spamming.</li>
        <li><strong>AI Disclosure:</strong> AI-generated content must be explicitly disclosed.</li>
      </ul>`,
    postId: 'guidelines',
    urlPath: '/mock/discourse/guidelines',
    timestamp: new Date().toISOString()
  }));
});

/**
 * Ghost Admin API Mock Server
 */
mockRouter.post('/ghost/ghost/api/admin/posts', (req: Request, res: Response) => {
  const postData = req.body.posts?.[0] || {};
  const id = `gh_${Date.now()}`;
  const slug = (postData.title ? postData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'publication-article').replace(/^-|-$/g, '') || 'publication-article';
  
  const record: MockPostRecord = {
    id,
    title: postData.title || 'Ghost Publication Article',
    body: postData.html || '<p>Published via IncuBrix Long-Tail Distribution Network.</p>',
    platform: 'Ghost Publisher',
    createdAt: new Date().toISOString(),
    url: `http://localhost:3000/mock/ghost/p/${slug}`,
    status: 'published',
    tags: ['creators', 'marketing', 'video'],
    score: '4 / 5'
  };

  mockPostsStore.set(slug, record);
  mockPostsStore.set(id, record);

  res.status(201).json({
    posts: [
      {
        id,
        slug,
        title: record.title,
        url: record.url,
        status: 'published'
      }
    ]
  });
});

mockRouter.get('/ghost/ghost/api/admin/posts/:id', (req: Request, res: Response) => {
  res.status(200).json({
    posts: [
      {
        id: req.params.id,
        status: 'published',
        url: `http://localhost:3000/mock/ghost/p/${req.params.id}`,
        page_views_count: 310
      }
    ]
  });
});

mockRouter.put('/ghost/ghost/api/admin/posts/:id', (req: Request, res: Response) => {
  res.status(200).json({
    posts: [{ id: req.params.id, status: req.body?.posts?.[0]?.status || 'draft' }]
  });
});

mockRouter.delete('/ghost/ghost/api/admin/posts/:id', (req: Request, res: Response) => {
  mockPostsStore.delete(req.params.id);
  res.status(204).send();
});

mockRouter.get(['/ghost/p/:slug', '/ghost/:slug'], (req: Request, res: Response) => {
  const { slug } = req.params;
  const post = mockPostsStore.get(slug) || {
    id: `gh_${slug}`,
    title: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    body: '<p>This is a live mock publication rendered via IncuBrix Long-Tail Destination Network.</p><p>Reviewers can verify automated publishing, status checks, and lifecycle management end-to-end.</p>',
    platform: 'Ghost Publisher',
    createdAt: new Date().toISOString(),
    url: `/mock/ghost/p/${slug}`,
    status: 'published'
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Ghost Publication • Live Verified',
    platform: 'Ghost',
    title: post.title,
    bodyHtml: post.body,
    postId: post.id,
    urlPath: `/mock/ghost/p/${slug}`,
    timestamp: post.createdAt,
    tags: ['creators', 'marketing', 'video'],
    score: '4 / 5'
  }));
});

mockRouter.get('/ghost/about', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Ghost Publication Information',
    platform: 'Ghost Publication',
    title: 'About Ghost Publisher Publication',
    bodyHtml: `<h3>Publication Policy:</h3>
      <ul>
        <li><strong>Frequency Cap:</strong> Maximum 10 articles per day.</li>
        <li><strong>Self-Promotion:</strong> Allowed with editorial relevance.</li>
        <li><strong>Links:</strong> Canonical links and references encouraged.</li>
        <li><strong>AI Content:</strong> High quality standards expected.</li>
      </ul>`,
    postId: 'about',
    urlPath: '/mock/ghost/about',
    timestamp: new Date().toISOString()
  }));
});

/**
 * Lemmy Federated Community Mock Server
 */
mockRouter.post('/lemmy/api/v3/user/login', (req: Request, res: Response) => {
  res.status(200).json({
    jwt: `mock_lemmy_jwt_${Date.now()}`
  });
});

mockRouter.post('/lemmy/api/v3/post', (req: Request, res: Response) => {
  const id = Math.floor(1000 + Math.random() * 9000);
  const name = req.body.name || 'IncuBrix Community Post';
  const body = req.body.body || 'Lemmy post body';

  const record: MockPostRecord = {
    id: String(id),
    title: name,
    body,
    platform: 'Lemmy Federation',
    createdAt: new Date().toISOString(),
    url: `http://localhost:3000/mock/lemmy/post/${id}`,
    status: 'published',
    tags: ['open-source', 'founders', 'ai'],
    score: '5 / 5'
  };

  mockPostsStore.set(String(id), record);
  mockPostsStore.set(`lem_${id}`, record);

  res.status(200).json({
    post_view: {
      post: {
        id,
        name,
        body,
        ap_id: `http://localhost:3000/mock/lemmy/post/${id}`
      }
    }
  });
});

mockRouter.get('/lemmy/api/v3/post', (req: Request, res: Response) => {
  const id = String(req.query.id || '1001');
  const post = mockPostsStore.get(id);
  res.status(200).json({
    post_view: {
      post: {
        id: Number(id),
        name: post?.title || 'Lemmy Discussion',
        body: post?.body || 'Lemmy body',
        deleted: false,
        score: 47
      }
    }
  });
});

mockRouter.post('/lemmy/api/v3/post/delete', (req: Request, res: Response) => {
  mockPostsStore.delete(String(req.body.post_id));
  res.status(200).json({
    post_view: {
      post: {
        id: req.body.post_id,
        deleted: true
      }
    }
  });
});

mockRouter.get('/lemmy/post/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const post = mockPostsStore.get(id) || mockPostsStore.get(`lem_${id}`) || {
    id,
    title: 'Lemmy Community Discussion',
    body: 'Automated post submitted via IncuBrix Distribution Network to Lemmy federated community.',
    platform: 'Lemmy Community',
    createdAt: new Date().toISOString(),
    url: `/mock/lemmy/post/${id}`,
    status: 'published'
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Lemmy Community • Federated Post',
    platform: 'Lemmy',
    title: post.title,
    bodyHtml: `<div style="white-space: pre-wrap; font-size: 15px;">${escapeHtml(post.body)}</div>`,
    postId: `post_${id}`,
    urlPath: `/mock/lemmy/post/${id}`,
    timestamp: post.createdAt,
    tags: ['open-source', 'founders', 'ai'],
    score: '5 / 5'
  }));
});

mockRouter.get('/lemmy/rules', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Lemmy Community Rules',
    platform: 'Lemmy Rules',
    title: 'Lemmy Community Rules & Policies',
    bodyHtml: `<h3>Community Rules:</h3>
      <ul>
        <li><strong>Frequency Cap:</strong> Maximum 10 posts per day.</li>
        <li><strong>Self-Promotion:</strong> Permitted for open-source and developer tooling with transparent disclosure.</li>
        <li><strong>Links:</strong> Allowed to original repositories and documentation.</li>
        <li><strong>Conduct:</strong> Be respectful and supportive of builders.</li>
      </ul>`,
    postId: 'rules',
    urlPath: '/mock/lemmy/rules',
    timestamp: new Date().toISOString()
  }));
});

/**
 * Webhook (HMAC Signed) Mock Server
 */
mockRouter.post('/webhook/incoming', (req: Request, res: Response) => {
  const eventId = `wh_evt_${Date.now()}`;
  const payload = req.body;
  const title = payload.title || payload.event || payload.action || 'Partner Network Ingestion Event';
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

  const record: MockPostRecord = {
    id: eventId,
    title,
    body,
    platform: 'Partner Webhook',
    createdAt: new Date().toISOString(),
    url: `http://localhost:3000/mock/webhook/events/${eventId}`,
    status: 'delivered',
    tags: ['saas', 'distribution'],
    score: '4 / 5'
  };

  mockPostsStore.set(eventId, record);

  res.status(200).json({
    received: true,
    id: eventId,
    timestamp: record.createdAt
  });
});

mockRouter.get(['/webhook/events/:id', '/webhook/incoming/:id'], (req: Request, res: Response) => {
  const { id } = req.params;
  const post = mockPostsStore.get(id) || {
    id,
    title: 'Partner Webhook Event Delivery',
    body: JSON.stringify({ event: 'publication.created', event_id: id, status: 'delivered', signature_valid: true }, null, 2),
    platform: 'Signed Webhook (HMAC)',
    createdAt: new Date().toISOString(),
    url: `/mock/webhook/events/${id}`,
    status: 'delivered'
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Partner Webhook • HMAC-SHA256 Signed',
    platform: 'Signed Webhook',
    title: post.title,
    bodyHtml: `<pre style="background: #141C16; color: #A6E3B8; padding: 18px; border-radius: 8px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 13px;">${escapeHtml(post.body)}</pre>`,
    postId: id,
    urlPath: `/mock/webhook/events/${id}`,
    timestamp: post.createdAt,
    tags: ['saas', 'distribution'],
    score: '4 / 5'
  }));
});

/**
 * Hashnode GraphQL Mock Server
 */
mockRouter.post('/hashnode/graphql', (req: Request, res: Response) => {
  const id = `hash_${Date.now()}`;
  const title = 'IncuBrix Hashnode Engineering Article';
  const record: MockPostRecord = {
    id,
    title,
    body: '<p>Article published to Hashnode developer network via GraphQL endpoint.</p>',
    platform: 'Hashnode Developer Blog',
    createdAt: new Date().toISOString(),
    url: `http://localhost:3000/mock/hashnode/p/${id}`,
    status: 'published',
    tags: ['developers', 'engineering', 'saas'],
    score: '4 / 5'
  };
  mockPostsStore.set(id, record);

  res.status(200).json({
    data: {
      publishPost: {
        post: {
          id,
          title,
          url: record.url,
          slug: 'incubrix-post'
        }
      }
    }
  });
});

mockRouter.get('/hashnode/p/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const post = mockPostsStore.get(id) || {
    id,
    title: 'Developer Engineering Post',
    body: '<p>Article published to developer network via GraphQL endpoint.</p>',
    platform: 'Hashnode Developer Blog',
    createdAt: new Date().toISOString(),
    url: `/mock/hashnode/p/${id}`,
    status: 'published'
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Hashnode Publication • GraphQL Syndication',
    platform: 'Hashnode',
    title: post.title,
    bodyHtml: post.body,
    postId: id,
    urlPath: `/mock/hashnode/p/${id}`,
    timestamp: post.createdAt,
    tags: ['developers', 'engineering', 'saas'],
    score: '4 / 5'
  }));
});

/**
 * Dev.to Simulation & Mock API Endpoints
 */
mockRouter.post('/devto/api/articles', (req: Request, res: Response) => {
  const article = req.body?.article || {};
  const id = Math.floor(100000 + Math.random() * 900000);
  const title = article.title || 'IncuBrix Developer Article';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article';

  const record: MockPostRecord = {
    id: String(id),
    title,
    body: article.body_markdown || '<p>Published via IncuBrix Distribution Network.</p>',
    platform: 'Dev.to Developer Blog',
    createdAt: new Date().toISOString(),
    url: `http://localhost:3000/mock/devto/article/${id}`,
    status: 'published',
    tags: article.tags || ['developers', 'ai', 'saas'],
    score: '5 / 5'
  };

  mockPostsStore.set(String(id), record);

  res.status(201).json({
    id,
    title: record.title,
    description: 'Published via IncuBrix Long-Tail Distribution Network',
    published: true,
    url: record.url,
    body_markdown: article.body_markdown,
    tags: record.tags
  });
});

mockRouter.get('/devto/api/articles/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const post = mockPostsStore.get(id);
  if (!post) {
    return res.status(200).json({ id: Number(id), published: false, status: 'removed' });
  }
  res.status(200).json({
    id: Number(id),
    title: post.title,
    published: post.status === 'published',
    url: post.url
  });
});

mockRouter.put('/devto/api/articles/:id/unpublish', (req: Request, res: Response) => {
  const id = req.params.id;
  const post = mockPostsStore.get(id);
  if (post) {
    post.status = 'unpublished';
  }
  res.status(200).json({ success: true, id: Number(id), published: false });
});

mockRouter.delete('/devto/api/articles/:id', (req: Request, res: Response) => {
  mockPostsStore.delete(req.params.id);
  res.status(200).json({ success: true });
});

/**
 * Dev.to Simulation / Mock Article Preview
 */
mockRouter.get('/devto/article/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const post = mockPostsStore.get(id) || {
    id,
    title: 'Developer Publishing Article (Dev.to Simulation)',
    body: '<p>Developer post published via IncuBrix Distribution Network in Simulation/Mock Mode.</p><p>Reviewers can also provide a real <code>DEVTO_API_KEY</code> in <code>.env</code> to publish live articles to dev.to.</p>',
    platform: 'Dev.to Developer Blog',
    createdAt: new Date().toISOString(),
    url: `/mock/devto/article/${id}`,
    status: 'published'
  };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Dev.to Developer Blog • Simulation / Mock Mode',
    platform: 'Dev.to',
    title: post.title,
    bodyHtml: post.body,
    postId: id,
    urlPath: `/mock/devto/article/${id}`,
    timestamp: post.createdAt,
    tags: ['developers', 'ai', 'saas'],
    score: '5 / 5'
  }));
});

mockRouter.get('/devto/terms', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHtmlPreview({
    badge: 'Dev.to Community Terms',
    platform: 'Dev.to Guidelines',
    title: 'Dev.to Terms of Use & Community Guidelines',
    bodyHtml: `<h3>Developer Publishing Guidelines:</h3>
      <ul>
        <li><strong>Frequency Cap:</strong> Maximum 10 posts per day.</li>
        <li><strong>Self-Promotion:</strong> Permitted with genuine technical value.</li>
        <li><strong>AI Disclosure:</strong> Explicit disclosure required for generated articles.</li>
        <li><strong>Code Standards:</strong> Provide clear formatting and respectful discourse.</li>
      </ul>`,
    postId: 'terms',
    urlPath: '/mock/devto/terms',
    timestamp: new Date().toISOString()
  }));
});

/**
 * Slack Community Mock Server
 */
mockRouter.post('/slack/api/chat.postMessage', (req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    channel: 'C12345678',
    ts: `${Date.now() / 1000}`,
    message: {
      text: req.body.text
    }
  });
});
