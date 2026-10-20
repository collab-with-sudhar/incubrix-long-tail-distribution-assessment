// Test script to verify clean-machine publishing and reaper tracking
const testPublish = async () => {
  const targets = [
    {
      name: 'Dev.to (Mock - No API Key)',
      destination_id: 'dest_devto_main',
      rendition: {
        title: 'Dev.to Clean Machine Test',
        body: 'Testing Dev.to mock connector with zero real API keys required.',
        tags: ['test', 'cleanmachine'],
        is_ai_generated: true,
        is_promotional: false
      }
    },
    {
      name: 'Ghost (Real Local Container)',
      destination_id: 'dest_ghost_blog',
      rendition: {
        title: 'Ghost Local Clean Machine Test',
        body: 'Testing Ghost local Docker instance with Admin API integration key.',
        tags: ['ghost', 'cleanmachine'],
        is_ai_generated: false,
        is_promotional: false
      }
    },
    {
      name: 'Lemmy (Real Local Container)',
      destination_id: 'dest_lemmy_tech',
      rendition: {
        title: 'Lemmy Local Clean Machine Test',
        body: 'Testing Lemmy local Docker instance with auto-provisioned user.',
        tags: ['lemmy', 'cleanmachine'],
        is_ai_generated: false,
        is_promotional: false
      }
    },
    {
      name: 'Discourse (Mock Server)',
      destination_id: 'dest_discourse_meta',
      rendition: {
        title: 'Discourse Mock Test Discussion',
        body: 'Testing Discourse mock server posting and topic creation flow.',
        tags: ['discourse', 'discussion'],
        is_ai_generated: false,
        is_promotional: false
      }
    },
    {
      name: 'Webhook (Mock Server)',
      destination_id: 'dest_webhook_partner',
      rendition: {
        title: 'Webhook Mock Event',
        body: 'Testing partner webhook syndication payload distribution.',
        is_ai_generated: false,
        is_promotional: false
      }
    }
  ];

  console.log('=== Step 1: Publishing across all destinations ===');
  for (const t of targets) {
    try {
      const res = await fetch('http://localhost:3000/api/v1/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: t.destination_id,
          rendition: t.rendition
        })
      });
      const data = await res.json();
      console.log(`[${res.status}] ${t.name}:`, {
        post_id: data.platform_post_id,
        live_url: data.live_url,
        status: data.status
      });
    } catch (e) {
      console.error(`FAILED ${t.name}:`, e.message);
    }
  }

  console.log('\n=== Step 2: Checking Must-Have 5 Reaper Tracked Posts ===');
  try {
    const res = await fetch('http://localhost:3000/api/v1/cleanup/posts');
    const reaperData = await res.json();
    console.log('Tracked posts count:', reaperData.total_tracked);
    console.log('Active test posts:', reaperData.active_test_posts.map(p => ({
      platform_post_id: p.platformPostId,
      connector: p.connectorKey,
      destination: p.destination.name,
      remaining_seconds: p.remaining_seconds
    })));
  } catch (e) {
    console.error('Failed to get reaper posts:', e.message);
  }

  console.log('\n=== Step 3: Triggering Must-Have 5 Purge / Deletion ===');
  try {
    const purgeRes = await fetch('http://localhost:3000/api/v1/cleanup/purge', { method: 'POST' });
    const purgeData = await purgeRes.json();
    console.log('Purge result:', purgeData);

    const afterRes = await fetch('http://localhost:3000/api/v1/cleanup/posts');
    const afterData = await afterRes.json();
    console.log('Active test posts after purge:', afterData.active_test_posts.length);
    console.log('History (cleaned up posts):', afterData.history.length);
  } catch (e) {
    console.error('Failed to purge:', e.message);
  }
};

testPublish();
