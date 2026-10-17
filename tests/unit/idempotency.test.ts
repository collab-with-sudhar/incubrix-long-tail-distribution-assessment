import request from 'supertest';
import app from '../../src/server.js';
import { globalIdempotencyStore } from '../../src/middleware/idempotency.js';

describe('Must-Have 6 & Integration Standard 4: Safe Retries & Idempotency', () => {
  beforeEach(() => {
    globalIdempotencyStore.clear();
  });

  const payload = {
    rendition: {
      title: 'Idempotent Publish Test',
      body: 'Testing safe retry semantics across distribution network'
    },
    destination_id: 'dest_discourse_meta'
  };

  test('submitting identical request with same Idempotency-Key returns cached result and never duplicates', async () => {
    const key = `test_idemp_key_${Date.now()}`;

    // Request 1
    const res1 = await request(app)
      .post('/api/v1/publish')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body.platform_post_id).toBeDefined();
    const firstPostId = res1.body.platform_post_id;

    // Request 2 (Retry with same idempotency key)
    const res2 = await request(app)
      .post('/api/v1/publish')
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.header['x-cache-lookup']).toBe('HIT');
    expect(res2.body.platform_post_id).toBe(firstPostId);
  });
});
