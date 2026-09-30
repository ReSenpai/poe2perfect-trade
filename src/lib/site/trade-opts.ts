/**
 * Options the trade page boots with: `window.tradeOpts = {…};` in an inline script. Content scripts run in an isolated
 * world, so the script text is parsed instead of reading `window.tradeOpts`. `state` is the decoded search query.
 */
export interface TradeOpts {
  tab: string;
  realm: string;
  league: string;
  leagues: { id: string; realm?: string; text: string }[];
  state: Record<string, unknown> | null;
}

export type TradeOptsResult = { ok: true; opts: TradeOpts } | { ok: false; error: 'missing' | 'invalid' };

const MARKER = /window\.tradeOpts\s*=\s*/;

export function readTradeOpts(page: Document | string): TradeOptsResult {
  const doc = typeof page === 'string' ? new DOMParser().parseFromString(page, 'text/html') : page;
  const script = [...doc.querySelectorAll('script:not([src])')].map((node) => node.textContent ?? '').find((text) => MARKER.test(text));
  if (script === undefined) return { ok: false, error: 'missing' };

  const start = MARKER.exec(script)!;
  const json = objectLiteralAt(script, start.index + start[0].length);
  if (json === null) return { ok: false, error: 'invalid' };

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (typeof raw.league !== 'string') return { ok: false, error: 'invalid' };

  return {
    ok: true,
    opts: {
      tab: typeof raw.tab === 'string' ? raw.tab : '',
      realm: typeof raw.realm === 'string' ? raw.realm : '',
      league: raw.league,
      leagues: Array.isArray(raw.leagues) ? (raw.leagues as TradeOpts['leagues']) : [],
      state: isObject(raw.state) ? raw.state : null,
    },
  };
}

/** The `{…}` starting at `from`, matched by braces outside of strings; null when it is not closed. */
function objectLiteralAt(text: string, from: number): string | null {
  if (text[from] !== '{') return null;
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return text.slice(from, i + 1);
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
