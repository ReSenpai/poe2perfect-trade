import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { CaptureResult, ListingsFixture } from '@/lib/dev/fixture';
import { ExportPanel } from './ExportPanel';

const FIXTURE: ListingsFixture = {
  meta: { league: 'Forbidden Rites', capturedAt: '2026-09-18T07:00:00.000Z' },
  request: { query: { status: { option: 'online' } }, sort: { price: 'asc' } },
  search: { id: 'H4sIx', total: 1137, result: ['a', 'b'] },
  listings: [],
};

const SUCCESS: CaptureResult = { ok: true, fileName: 'listings-online.json', fixture: FIXTURE };

function clickExport() {
  fireEvent.click(screen.getByRole('button', { name: 'Export fixture' }));
}

describe('ExportPanel', () => {
  it('saves the captured fixture as indented JSON and summarises it', async () => {
    const save = vi.fn();
    render(<ExportPanel capture={async () => SUCCESS} save={save} />);

    clickExport();

    await screen.findByText('Saved: listings-online.json');
    screen.getByText('Forbidden Rites · found: 1137 · listings: 0');
    expect(save).toHaveBeenCalledWith('listings-online.json', JSON.stringify(FIXTURE, null, 1) + '\n');
  });

  it('disables the button while capturing', async () => {
    let finish!: (result: CaptureResult) => void;
    render(<ExportPanel capture={() => new Promise((resolve) => (finish = resolve))} save={vi.fn()} />);

    clickExport();

    const button = await screen.findByRole('button', { name: 'Capturing…' });
    expect(button).toHaveProperty('disabled', true);
    finish(SUCCESS);
    await screen.findByText('Saved: listings-online.json');
  });

  it('shows a capture failure and saves nothing', async () => {
    const save = vi.fn();
    render(<ExportPanel capture={async () => ({ ok: false, message: 'No search query on this page' })} save={save} />);

    clickExport();

    await screen.findByText('No search query on this page');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows an error when capture throws', async () => {
    render(
      <ExportPanel
        capture={async () => {
          throw new Error('Could not establish connection');
        }}
        save={vi.fn()}
      />,
    );

    clickExport();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not establish connection'));
  });
});
