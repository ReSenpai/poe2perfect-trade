/**
 * The trade site keeps the whole query in the URL (and uses it as the search id): base64url(gzip(JSON)).
 * See docs/ARCHITECTURE.md, "Trade API".
 */

/** The query object, or null when the value is not a gzip-compressed JSON object. */
export async function decodeQueryParam(value: string): Promise<Record<string, unknown> | null> {
  try {
    const bytes = fromBase64Url(value);
    if (bytes.length === 0) return null;
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function encodeQueryParam(query: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(query)]).stream().pipeThrough(new CompressionStream('gzip'));
  return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
