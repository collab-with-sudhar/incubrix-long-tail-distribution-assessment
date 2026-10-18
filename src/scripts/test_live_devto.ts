import dotenv from 'dotenv';
dotenv.config();

// Turn off simulation mode for this specific live test
process.env.SIMULATION_MODE = 'false';

import { DevtoConnector } from '../connectors/devto.js';

async function testLiveDevto() {
  const connector = new DevtoConnector();
  const testDest = {
    name: 'Dev.to Live Community',
    url: 'https://dev.to',
    platform_key: 'devto',
    surface: 'article',
    connector_key: 'devto'
  };

  const rendition = {
    title: 'Automated IncuBrix Connector Test ' + Date.now(),
    body: '## IncuBrix Connector Contract Live Verification\n\nThis article is an automated verification of the IncuBrix connector contract.\n\n- Real HTTP API delivery\n- Clean automated lifecycle',
    canonical_url: 'https://incubrix.com/distribution',
    tags: ['test', 'discuss']
  };

  console.log('1. Publishing live article to Dev.to...');
  const pub = await connector.publish(rendition, testDest, {}, 'live_test_' + Date.now());
  console.log('✓ Published! Post ID:', pub.platform_post_id);
  console.log('✓ Live URL:', pub.live_url);

  console.log('\n2. Querying status from Dev.to API...');
  const status = await connector.getStatus(pub.platform_post_id, {});
  console.log('✓ Status:', status.status, 'Live URL:', status.live_url);

  console.log('\n3. Querying metrics from Dev.to API...');
  const metrics = await connector.fetchMetrics(pub.platform_post_id, {});
  console.log('✓ Metrics:', JSON.stringify(metrics));

  console.log('\n4. Cleaning up (unpublishing) live article...');
  const del = await connector.delete(pub.platform_post_id, {});
  console.log('✓ Cleanup confirmed:', del.deleted);

  console.log('\n5. Querying status after unpublishing...');
  const statusAfter = await connector.getStatus(pub.platform_post_id, {});
  console.log('✓ Post Status After Cleanup:', statusAfter.status);
  console.log('\n✅ Live Dev.to Contract Verification Complete!');
}

testLiveDevto().catch((err) => {
  console.error('Test failed:', err.message, err.details || '');
  process.exit(1);
});
