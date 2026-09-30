/** Own family name, so the page's fonts can never shadow or be shadowed by ours. */
export const FONT_FAMILY = 'poe2perfect trade Inter';

export interface FontSource {
  dataUrl: string;
  unicodeRange: string;
}

const registered = new WeakSet<object>();

/**
 * Registers bundled font files through the FontFace API. The site's CSP only allows http(s) font URLs,
 * but faces built from in-memory data are not fetched, so they are not subject to it.
 * Document-level fonts are usable inside the UI's shadow root.
 */
export function registerFonts({
  fontSet,
  FontFace: FontFaceCtor,
  sources,
}: {
  fontSet: { add(face: FontFace): unknown };
  FontFace: typeof FontFace;
  sources: FontSource[];
}): void {
  if (registered.has(fontSet)) return;
  registered.add(fontSet);
  for (const { dataUrl, unicodeRange } of sources) {
    const face = new FontFaceCtor(FONT_FAMILY, decodeDataUrl(dataUrl), { weight: '100 900', style: 'normal', display: 'swap', unicodeRange });
    fontSet.add(face);
  }
}

function decodeDataUrl(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
