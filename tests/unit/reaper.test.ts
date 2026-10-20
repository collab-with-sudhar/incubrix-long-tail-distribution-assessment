import { TestPostReaper } from '../../src/cleanup/reaper.js';
import { globalRegistry } from '../../src/connectors/registry.js';
import { Destination } from '../../src/types/contract.js';

describe('Must-Have 5: 10-Minute Auto-Cleanup Reaper', () => {
  let reaper: TestPostReaper;

  const mockDestination: Destination = {
    id: 'dest_test_ghost',
    name: 'Test Destination',
    url: 'http://localhost:3000/mock/ghost',
    connector_key: 'ghost',
    platform_key: 'ghost',
    surface: 'post'
  };

  beforeEach(() => {
    reaper = new TestPostReaper();
  });

  afterEach(() => {
    reaper.stop();
  });

  it('tracks published test posts with 10-minute default TTL', () => {
    const post = reaper.track({
      platformPostId: 'test_post_123',
      connectorKey: 'ghost',
      destination: mockDestination,
      title: 'Automated Test Post'
    });

    expect(post).toBeDefined();
    expect(post.platformPostId).toBe('test_post_123');
    expect(post.deleteAfterMs).toBe(10 * 60 * 1000); // 10 minutes
    expect(post.deleted).toBe(false);

    const list = reaper.list();
    expect(list.length).toBe(1);
    expect(list[0].remaining_seconds).toBeGreaterThan(0);
  });

  it('reaps posts that exceed their TTL limit', async () => {
    // Register a mock connector or use an existing one
    const ghostConnector = globalRegistry.get('ghost');
    const deleteSpy = jest.spyOn(ghostConnector, 'delete').mockResolvedValue({
      deleted: true,
      platform_post_id: 'expired_post_1'
    });

    // Track a post with 1ms TTL
    reaper.track({
      platformPostId: 'expired_post_1',
      connectorKey: 'ghost',
      destination: mockDestination,
      deleteAfterMs: 1 // expires immediately
    });

    // Wait 10ms
    await new Promise(r => setTimeout(r, 10));

    const reaped = await reaper.reapExpired();
    expect(reaped).toBe(1);
    expect(deleteSpy).toHaveBeenCalledWith('expired_post_1', expect.anything());

    const list = reaper.list();
    expect(list[0].deleted).toBe(true);

    deleteSpy.mockRestore();
  });

  it('purges all test posts immediately on demand', async () => {
    const ghostConnector = globalRegistry.get('ghost');
    const deleteSpy = jest.spyOn(ghostConnector, 'delete').mockResolvedValue({
      deleted: true,
      platform_post_id: 'purge_post'
    });

    reaper.track({
      platformPostId: 'purge_post_1',
      connectorKey: 'ghost',
      destination: mockDestination
    });
    reaper.track({
      platformPostId: 'purge_post_2',
      connectorKey: 'ghost',
      destination: mockDestination
    });

    const result = await reaper.purgeAll();
    expect(result.deleted).toBe(2);
    expect(result.errors).toBe(0);

    const list = reaper.list();
    expect(list.every(p => p.deleted)).toBe(true);

    deleteSpy.mockRestore();
  });
});
