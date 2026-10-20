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

  test('continuous multiple presses (5 rapid calls) with same key all return the exact same post', async () => {
    const key = `test_multi_press_${Date.now()}`;

    // 5 calls with the same key
    const results = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/publish')
        .set('Idempotency-Key', key)
        .send(payload);
      results.push(res);
    }

    const firstId = results[0].body.platform_post_id;
    expect(results[0].status).toBe(200);

    // All subsequent 4 calls must be CACHE HIT and match the exact first post ID
    for (let i = 1; i < 5; i++) {
      expect(results[i].status).toBe(200);
      expect(results[i].header['x-cache-lookup']).toBe('HIT');
      expect(results[i].body.platform_post_id).toBe(firstId);
    }
  });

  test('concurrent in-flight retries wait for completion and resolve with same post ID', async () => {
    const key = `test_concurrent_${Date.now()}`;

    // Fire 2 requests simultaneously
    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/publish').set('Idempotency-Key', key).send(payload),
      request(app).post('/api/v1/publish').set('Idempotency-Key', key).send(payload)
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.platform_post_id).toBe(res2.body.platform_post_id);
  });
});
