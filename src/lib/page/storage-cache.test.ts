import { describe, expect, it, vi } from 'vitest';
import { createStorageCache } from './storage-cache';

function fakeArea(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  return {
    data,
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(data, items)),
  };
}

describe('createStorageCache', () => {
  it('reads and writes values under a prefix', async () => {
    const area = fakeArea({ 'poe2trade:catalog:stats': { savedAt: 1, data: [] } });
    const cache = createStorageCache(area);

    await expect(cache.get('catalog:stats')).resolves.toEqual({ savedAt: 1, data: [] });
    await expect(cache.get('catalog:items')).resolves.toBeUndefined();
    await cache.set('catalog:items', { savedAt: 2, data: [1] });
    expect(area.data['poe2trade:catalog:items']).toEqual({ savedAt: 2, data: [1] });
  });

  it('treats a failing storage as empty and never throws', async () => {
    const area = {
      get: vi.fn(async () => {
        throw new Error('QUOTA_BYTES');
      }),
      set: vi.fn(async () => {
        throw new Error('QUOTA_BYTES');
      }),
    };
    const cache = createStorageCache(area);
    await expect(cache.get('x')).resolves.toBeUndefined();
    await expect(cache.set('x', 1)).resolves.toBeUndefined();
  });
});
