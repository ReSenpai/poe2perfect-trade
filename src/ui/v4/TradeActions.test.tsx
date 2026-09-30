import { act, fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { parseListing } from '@/lib/listing/parse';
import { loadListings } from '../../../tests/fixtures/load';
import { TradeActions } from './TradeActions';

const PERSON = parseListing(loadListings('listings-rings').listings[0]!);
const INSTANT = parseListing(loadListings('listings-securable').listings[0]!);
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('TradeActions', () => {
  it('copies the whisper of an In person listing as the site wrote it, and says so', async () => {
    const copy = vi.fn(async () => {});
    render(<TradeActions listing={PERSON} copy={copy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy whisper' }));
    await flush();
    expect(copy).toHaveBeenCalledWith(PERSON.whisper);
    expect(screen.getByRole('status').textContent).toBe('Copied');
  });

  it('has no whisper to copy for Instant buyout', () => {
    render(<TradeActions listing={INSTANT} copy={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Copy whisper' })).toBeNull();
  });

  it('does not offer Copy item for now', () => {
    render(<TradeActions listing={PERSON} copy={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Copy item' })).toBeNull();
  });

  it('shows the text to copy by hand when the clipboard refuses', async () => {
    const copy = vi.fn(async () => {
      throw new Error('denied');
    });
    render(<TradeActions listing={PERSON} copy={copy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy whisper' }));
    await flush();
    const field = screen.getByRole('textbox', { name: 'Text to copy' }) as HTMLTextAreaElement;
    expect(field.value).toBe(PERSON.whisper);
    expect(screen.getByText('Copy it with Ctrl+C')).toBeTruthy();
  });

  it('travels to the hideout of an Instant buyout seller on a click, once while it runs', async () => {
    let finish!: (outcome: 'sent' | 'in-demand') => void;
    const whisper = vi.fn(() => new Promise<'sent' | 'in-demand'>((resolve) => (finish = resolve)));
    render(<TradeActions listing={INSTANT} copy={vi.fn()} whisper={whisper} />);
    const travel = screen.getByRole('button', { name: 'Travel to hideout' });
    fireEvent.click(travel);
    fireEvent.click(travel);
    expect(whisper).toHaveBeenCalledExactlyOnceWith('scrubbed', {});
    expect((travel as HTMLButtonElement).disabled).toBe(true);
    finish('sent');
    await flush();
    expect(screen.getByRole('status').textContent).toBe("Travelling to the seller's hideout");
  });

  it('keeps trying an item in demand only when asked again', async () => {
    const whisper = vi.fn(async (): Promise<'sent' | 'in-demand'> => 'in-demand');
    render(<TradeActions listing={INSTANT} copy={vi.fn()} whisper={whisper} />);
    fireEvent.click(screen.getByRole('button', { name: 'Travel to hideout' }));
    await flush();
    expect(screen.getByRole('status').textContent).toBe('Item is in demand — click again to keep trying');
    fireEvent.click(screen.getByRole('button', { name: 'Travel to hideout' }));
    await flush();
    expect(whisper).toHaveBeenLastCalledWith('scrubbed', { continue: true });
  });

  it('shows what the site said when it refuses', async () => {
    const whisper = vi.fn(async (): Promise<'sent' | 'in-demand'> => {
      throw new Error('Character not online');
    });
    render(<TradeActions listing={INSTANT} copy={vi.fn()} whisper={whisper} />);
    fireEvent.click(screen.getByRole('button', { name: 'Travel to hideout' }));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('Character not online');
  });

  it('sends the whisper into the game for In person on a click', async () => {
    const whisper = vi.fn(async (): Promise<'sent' | 'in-demand'> => 'sent');
    render(<TradeActions listing={PERSON} copy={vi.fn()} whisper={whisper} />);
    fireEvent.click(screen.getByRole('button', { name: 'Direct whisper' }));
    await flush();
    expect(whisper).toHaveBeenCalledWith('scrubbed', {});
    expect(screen.getByRole('status').textContent).toBe('Whisper sent');
  });

  it('offers no travel for remembered results (no token), and no note about it', () => {
    const { container } = render(<TradeActions listing={{ ...INSTANT, tokens: undefined }} copy={vi.fn()} whisper={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Travel to hideout' })).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('offers nothing that sends without a way to send', () => {
    render(<TradeActions listing={INSTANT} copy={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Travel to hideout' })).toBeNull();
  });

  it('offers only Copy whisper for a seller of remembered results', () => {
    render(<TradeActions listing={{ ...PERSON, tokens: undefined }} copy={vi.fn()} whisper={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Direct whisper' })).toBeNull();
    expect(screen.queryByText(/Refresh results/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy whisper' })).toBeTruthy();
  });
});
