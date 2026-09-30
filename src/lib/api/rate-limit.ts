/**
 * X-Rate-Limit-* headers of api/trade2: `X-Rate-Limit-Rules: Account,Ip`, then per rule
 * `X-Rate-Limit-<Rule>: hits:period:penalty,…` and `X-Rate-Limit-<Rule>-State: current:period:restricted,…`.
 */
export interface RateLimitWindow {
  rule: string;
  /** Requests allowed per `period` seconds. */
  hits: number;
  period: number;
  /** Seconds of lockout for going over. */
  penalty: number;
  /** Requests made in the current period, including this one. */
  current: number;
  /** Seconds of lockout left (0 when not locked out). */
  restricted: number;
}

export interface RateLimitInfo {
  policy: string | null;
  windows: RateLimitWindow[];
}

export function parseRateLimit(headers: Headers): RateLimitInfo | null {
  const rules = headers.get('x-rate-limit-rules');
  if (!rules) return null;

  const windows: RateLimitWindow[] = [];
  for (const rule of rules.split(',').map((name) => name.trim()).filter(Boolean)) {
    const limits = triples(headers.get(`x-rate-limit-${rule.toLowerCase()}`));
    const states = triples(headers.get(`x-rate-limit-${rule.toLowerCase()}-state`));
    limits.forEach((limit, index) => {
      const state = states[index];
      if (!limit || !state) return;
      windows.push({ rule, hits: limit[0], period: limit[1], penalty: limit[2], current: state[0], restricted: state[2] });
    });
  }
  return { policy: headers.get('x-rate-limit-policy'), windows };
}

/**
 * How long to hold the next request. A full window is waited out for its whole period: the headers do not say when
 * the oldest request leaves it, so this stays on the safe side.
 */
export function waitMs(info: RateLimitInfo): number {
  let wait = 0;
  for (const window of info.windows) {
    if (window.restricted > 0) wait = Math.max(wait, window.restricted * 1000);
    else if (window.current >= window.hits) wait = Math.max(wait, window.period * 1000);
  }
  return wait;
}

/** "3:5:60,8:10:60" → [[3, 5, 60], [8, 10, 60]]; unreadable parts become null so indexes stay aligned. */
function triples(header: string | null): ([number, number, number] | null)[] {
  if (!header) return [];
  return header.split(',').map((part) => {
    const numbers = part.split(':').map(Number);
    return numbers.length === 3 && numbers.every(Number.isFinite) ? (numbers as [number, number, number]) : null;
  });
}
