// Test continuous pressing of the post button with same idempotency key against live container
const testContinuousPress = async () => {
  const key = `live_idemp_test_${Date.now()}`;
  const payload = {
    destination_id: 'dest_ghost_blog',
    rendition: {
      title: 'Must-Have 6 Live Idempotency Test',
      body: 'Verifying that continuous presses with identical idempotency key never duplicate.',
      tags: ['idempotency', 'test']
    }
  };

  console.log('=== Testing Continuous Post Presses (5 Rapid Requests) ===');
  console.log('Using Idempotency-Key:', key);

  const results = [];
  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    const res = await fetch('http://localhost:3000/api/v1/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key
      },
      body: JSON.stringify(payload)
    });
    const duration = Date.now() - start;
    const cacheHeader = res.headers.get('x-cache-lookup') || 'DIRECT';
    const data = await res.json();
    results.push({ attempt: i, status: res.status, cache: cacheHeader, post_id: data.platform_post_id, duration });
    console.log(`Press #${i} [${res.status}] Cache: ${cacheHeader} | Platform ID: ${data.platform_post_id} (${duration}ms)`);
  }

  const firstPostId = results[0].post_id;
  const allMatch = results.every(r => r.post_id === firstPostId);
  const cacheHits = results.filter(r => r.cache === 'HIT').length;

  console.log('\n=== Summary ===');
  console.log(`All 5 requests returned identical platform_post_id (${firstPostId}):`, allMatch ? 'YES (PASS)' : 'NO (FAIL)');
  console.log(`Replay requests served from cache: ${cacheHits} of 4 replays:`, cacheHits === 4 ? 'YES (PASS)' : 'NO (FAIL)');

  // Clean up
  console.log('\nCleaning up test post...');
  await fetch('http://localhost:3000/api/v1/cleanup/purge', { method: 'POST' });
  console.log('Cleanup complete.');
};

testContinuousPress();
