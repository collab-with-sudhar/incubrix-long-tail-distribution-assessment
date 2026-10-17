import request from 'supertest';
import app from '../../src/server.js';

describe('Integration Standard E2E Test Suite', () => {
  test('Integration Standard 8: GET /health and GET /ready return status', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('healthy');

    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ready');
  });

  test('Integration Standard 8: Returns X-Correlation-Id header', async () => {
    const customCorrelationId = 'test-corr-id-999';
    const res = await request(app)
      .get('/health')
      .set('X-Correlation-Id', customCorrelationId);

    expect(res.header['x-correlation-id']).toBe(customCorrelationId);
  });

  test('Integration Standard 5: Clear Errors in standard JSON structure', async () => {
    const res = await request(app)
      .post('/api/v1/publish')
      .send({}); // Missing rendition

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('DEST_SPEC_VIOLATION');
    expect(res.body.error.retryable).toBe(false);
  });

  test('Integration Standard 3 & 9: Background jobs & Output Manifest', async () => {
    const res = await request(app)
      .post('/api/v1/publish')
      .send({
        rendition: {
          title: 'Async Job Post',
          body: 'This should run as a background task'
        },
        destination_id: 'dest_ghost_blog',
        async: true
      });

    expect(res.status).toBe(202);
    expect(res.body.job_id).toBeDefined();
    expect(res.body.check_url).toBeDefined();

    const jobId = res.body.job_id;

    // Wait a brief moment for setImmediate execution
    await new Promise((r) => setTimeout(r, 100));

    const poll = await request(app).get(`/api/v1/jobs/${jobId}`);
    expect(poll.status).toBe(200);
    expect(['running', 'succeeded']).toContain(poll.body.status);

    if (poll.body.status === 'succeeded') {
      expect(poll.body.result.manifest).toBeDefined();
      expect(poll.body.result.manifest.licence).toBeDefined();
      expect(poll.body.result.manifest.timings.duration_ms).toBeGreaterThanOrEqual(0);
    }
  });

  test('Must-Have 3: Add new destination via configuration without code changes', async () => {
    const newForum = {
      id: 'dest_new_forum_41',
      name: 'Custom Review Forum #41',
      url: 'https://community.custom.org',
      platform_key: 'discourse',
      surface: 'topic',
      connector_key: 'discourse',
      frequency_cap: '1/day',
      self_promo_allowed: true,
      link_policy: 'allowed'
    };

    const addRes = await request(app)
      .post('/api/v1/destinations')
      .send(newForum);

    expect(addRes.status).toBe(201);
    expect(addRes.body.destination.id).toBe('dest_new_forum_41');

    // Verify it is immediately accessible
    const listRes = await request(app).get('/api/v1/destinations');
    const ids = listRes.body.destinations.map((d: any) => d.id);
    expect(ids).toContain('dest_new_forum_41');
  });
});
