import { describe, expect, it, vi } from 'vitest';
import { CAPTURE_FIXTURE_MESSAGE, listenForCapture, requestCapture } from './capture-messaging';
import type { CaptureResult } from './fixture';

const SUCCESS: CaptureResult = {
  ok: true,
  fileName: 'b.json',
  fixture: {
    meta: { league: 'Standard', capturedAt: 'now' },
    request: { query: {}, sort: { price: 'asc' } },
    search: { id: 'H4sIx', total: 0, result: [] },
    listings: [],
  },
};

describe('requestCapture', () => {
  it('asks the tab to capture and returns its answer', async () => {
    const sendMessage = vi.fn(async () => SUCCESS);

    const result = await requestCapture({ tabId: 7, sendMessage });

    expect(sendMessage).toHaveBeenCalledWith(7, { type: CAPTURE_FIXTURE_MESSAGE });
    expect(result).toEqual(SUCCESS);
  });

  it('fails without a tab', async () => {
    const result = await requestCapture({ tabId: undefined, sendMessage: vi.fn() });

    expect(result).toEqual({ ok: false, message: 'No active tab' });
  });

  it('explains what to do when the tab has no content script', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('Could not establish connection. Receiving end does not exist.');
    });

    const result = await requestCapture({ tabId: 7, sendMessage });

    expect(result).toEqual({ ok: false, message: 'Open a trade2 search page and reload it' });
  });

  it('reports other messaging errors', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('Message too large');
    });

    expect(await requestCapture({ tabId: 7, sendMessage })).toEqual({ ok: false, message: 'Message too large' });
  });

  it('rejects a malformed answer', async () => {
    const sendMessage = vi.fn(async () => undefined);

    expect(await requestCapture({ tabId: 7, sendMessage })).toEqual({ ok: false, message: 'The page did not answer' });
  });
});

describe('listenForCapture', () => {
  type Listener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined;

  function setup(capture: () => Promise<CaptureResult>) {
    let listener: Listener | undefined;
    const onMessage = { addListener: (fn: Listener) => (listener = fn), removeListener: vi.fn() };
    const stop = listenForCapture(onMessage, capture);
    return { listener: listener!, onMessage, stop };
  }

  it('answers a capture request asynchronously', async () => {
    const { listener } = setup(async () => SUCCESS);
    const sendResponse = vi.fn();

    const keepChannelOpen = listener({ type: CAPTURE_FIXTURE_MESSAGE }, {}, sendResponse);

    expect(keepChannelOpen).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(SUCCESS));
  });

  it('ignores unrelated messages', () => {
    const capture = vi.fn();
    const { listener } = setup(capture);

    expect(listener({ type: 'other' }, {}, vi.fn())).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });

  it('turns a thrown error into a failed result', async () => {
    const { listener } = setup(async () => {
      throw new Error('boom');
    });
    const sendResponse = vi.fn();

    listener({ type: CAPTURE_FIXTURE_MESSAGE }, {}, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, message: 'boom' }));
  });

  it('returns a function that removes the listener', () => {
    const { listener, onMessage, stop } = setup(async () => SUCCESS);

    stop();

    expect(onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});
