import { useEffect, useRef, useState } from 'preact/hooks';
import type { Listing } from '@/lib/listing/parse';
import { Icon } from '@/ui/kit/Icon';

const COPIED_MS = 2000;

export interface TradeActionsProps {
  listing: Listing;
  /** Puts text on the clipboard; rejects when the browser refuses. */
  copy?: (text: string) => Promise<void>;
  /** The site's whisper endpoint (Travel to hideout, Direct whisper); without it nothing here sends. */
  whisper?: (token: string, options: { continue?: boolean }) => Promise<'sent' | 'in-demand'>;
}

type SendState = { status: 'idle' } | { status: 'sending' } | { status: 'sent' } | { status: 'in-demand' } | { status: 'error'; message: string };

const clipboard = (text: string) => navigator.clipboard.writeText(text);

/**
 * What the user can do with a listing (v4 §13.3): Travel to hideout / Direct whisper, and copy the whisper the site wrote
 * (In person) as it is, in the seller's language. Copy item is hidden for now (its place is to be decided).
 */
export function TradeActions({ listing, copy = clipboard, whisper }: TradeActionsProps) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [send, setSend] = useState<SendState>({ status: 'idle' });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => field.current?.select(), [manual]);

  const put = async (text: string) => {
    try {
      await copy(text);
      setManual(null);
      setCopied(true);
    } catch {
      setManual(text);
    }
  };

  // Travel to hideout (Instant buyout) or Direct whisper (In person): acts in the user's game, only on this click.
  const direct = listing.instantBuyout
    ? { token: listing.tokens?.hideout, label: 'Travel to hideout', sending: 'Travelling…', sent: "Travelling to the seller's hideout" }
    : // Remembered results lost their tokens: then there is no button (Refresh brings them back).
      { token: listing.tokens?.whisper, label: 'Direct whisper', sending: 'Sending…', sent: 'Whisper sent' };
  const sendDirect = async () => {
    if (!whisper || !direct.token || send.status === 'sending') return;
    const again = send.status === 'in-demand';
    setSend({ status: 'sending' });
    try {
      setSend({ status: await whisper(direct.token, again ? { continue: true } : {}) });
    } catch (error) {
      setSend({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div class="p2t-trade-actions">
      {whisper && direct.token && (
        <button type="button" class="p2t-btn p2t-trade-actions__main" disabled={send.status === 'sending'} onClick={() => void sendDirect()}>
          <Icon name={listing.instantBuyout ? 'external' : 'message'} size={16} />
          {direct.label}
        </button>
      )}
      {send.status === 'sending' && (
        <span class="p2t-trade-actions__note" role="status">
          {direct.sending}
        </span>
      )}
      {send.status === 'sent' && (
        <span class="p2t-trade-actions__done" role="status">
          {direct.sent}
        </span>
      )}
      {send.status === 'in-demand' && (
        <span class="p2t-trade-actions__note" role="status">
          Item is in demand — click again to keep trying
        </span>
      )}
      {send.status === 'error' && (
        <span class="p2t-error" role="alert">
          {send.message}
        </span>
      )}
      {listing.whisper && (
        <button type="button" class="p2t-btn p2t-trade-actions__main" onClick={() => void put(listing.whisper!)}>
          <Icon name="message" size={16} />
          Copy whisper
        </button>
      )}
      {copied && (
        <span class="p2t-trade-actions__done" role="status">
          Copied
        </span>
      )}
      {manual !== null && (
        <div class="p2t-trade-actions__manual">
          <textarea ref={field} class="p2t-input" aria-label="Text to copy" readOnly rows={3} value={manual} />
          <p class="p2t-help">Copy it with Ctrl+C</p>
        </div>
      )}
    </div>
  );
}
