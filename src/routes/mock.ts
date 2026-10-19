import { Router, Request, Response } from 'express';
import crypto from 'crypto';

export const mockRouter = Router();

/**
 * Discourse Forum Mock Server
 */
mockRouter.post('/discourse/posts.json', (req: Request, res: Response) => {
  const id = Math.floor(1000 + Math.random() * 9000);
  const topicId = Math.floor(100 + Math.random() * 900);
  res.status(200).json({
    id,
    topic_id: topicId,
    topic_slug: 'community-discussion',
    raw: req.body.raw,
    title: req.body.title
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
  res.status(200).json({ success: 'OK' });
});

/**
 * Ghost Admin API Mock Server
 */
mockRouter.post('/ghost/ghost/api/admin/posts', (req: Request, res: Response) => {
  const id = `gh_${Date.now()}`;
  const slug = 'publication-article';
  res.status(201).json({
    posts: [
      {
        id,
        slug,
        title: req.body.posts?.[0]?.title || 'Publication',
        url: `http://localhost:3000/mock/ghost/p/${slug}`,
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
  res.status(204).send();
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
  res.status(200).json({
    post_view: {
      post: {
        id,
        name: req.body.name,
        body: req.body.body,
        ap_id: `http://localhost:3000/mock/lemmy/post/${id}`
      }
    }
  });
});

mockRouter.get('/lemmy/api/v3/post', (req: Request, res: Response) => {
  const id = req.query.id || '1001';
  res.status(200).json({
    post_view: {
      post: {
        id: Number(id),
        deleted: false,
        score: 47
      }
    }
  });
});

mockRouter.post('/lemmy/api/v3/post/delete', (req: Request, res: Response) => {
  res.status(200).json({
    post_view: {
      post: {
        id: req.body.post_id,
        deleted: true
      }
    }
  });
});

/**
 * Webhook (HMAC Signed) Mock Server
 */
mockRouter.post('/webhook/incoming', (req: Request, res: Response) => {
  const eventId = `wh_evt_${Date.now()}`;
  res.status(200).json({
    received: true,
    id: eventId,
    timestamp: new Date().toISOString()
  });
});

/**
 * Hashnode GraphQL Mock Server
 */
mockRouter.post('/hashnode/graphql', (req: Request, res: Response) => {
  const id = `hash_${Date.now()}`;
  res.status(200).json({
    data: {
      publishPost: {
        post: {
          id,
          title: 'Hashnode Article',
          url: `http://localhost:3000/mock/hashnode/p/${id}`,
          slug: 'hashnode-post'
        }
      }
    }
  });
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
