import { describe, expect, it } from 'vitest';
import { parseRateLimit, waitMs } from './rate-limit';

// Real headers of a search answer (docs/ARCHITECTURE.md, "Rate limits").
const SEARCH_HEADERS = new Headers({
  'x-rate-limit-policy': 'trade-search-request-limit',
  'x-rate-limit-rules': 'Account,Ip',
  'x-rate-limit-account': '3:5:60',
  'x-rate-limit-account-state': '1:5:0',
  'x-rate-limit-ip': '8:10:60,15:60:120,60:300:1800,600:10800:3600',
  'x-rate-limit-ip-state': '1:10:0,1:60:0,7:300:0,15:10800:0',
});

describe('parseRateLimit', () => {
  it('reads the policy and every window of every rule', () => {
    expect(parseRateLimit(SEARCH_HEADERS)).toEqual({
      policy: 'trade-search-request-limit',
      windows: [
        { rule: 'Account', hits: 3, period: 5, penalty: 60, current: 1, restricted: 0 },
        { rule: 'Ip', hits: 8, period: 10, penalty: 60, current: 1, restricted: 0 },
        { rule: 'Ip', hits: 15, period: 60, penalty: 120, current: 1, restricted: 0 },
        { rule: 'Ip', hits: 60, period: 300, penalty: 1800, current: 7, restricted: 0 },
        { rule: 'Ip', hits: 600, period: 10800, penalty: 3600, current: 15, restricted: 0 },
      ],
    });
  });

  it('returns null without rate limit headers (CDN-cached data)', () => {
    expect(parseRateLimit(new Headers({ 'cache-control': 'public' }))).toBeNull();
  });

  it('skips windows it cannot read', () => {
    const headers = new Headers({
      'x-rate-limit-rules': 'Account',
      'x-rate-limit-account': '3:5:60,bad',
      'x-rate-limit-account-state': '2:5:0',
    });
    expect(parseRateLimit(headers)).toEqual({
      policy: null,
      windows: [{ rule: 'Account', hits: 3, period: 5, penalty: 60, current: 2, restricted: 0 }],
    });
  });
});

describe('waitMs', () => {
  const window = { rule: 'Account', hits: 3, period: 5, penalty: 60, current: 1, restricted: 0 };

  it('is zero while every window has room', () => {
    expect(waitMs({ policy: null, windows: [window, { ...window, current: 2 }] })).toBe(0);
  });

  it('waits a whole period once a window is full', () => {
    expect(waitMs({ policy: null, windows: [window, { ...window, current: 3, period: 10 }] })).toBe(10_000);
  });

  it('waits out a restriction', () => {
    expect(waitMs({ policy: null, windows: [{ ...window, current: 4, restricted: 42 }] })).toBe(42_000);
  });
});
