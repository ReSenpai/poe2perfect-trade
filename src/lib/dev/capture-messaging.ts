import type { CaptureResult } from './fixture';

export const CAPTURE_FIXTURE_MESSAGE = 'poe2-trade:capture-fixture';

const NO_RECEIVER = /Receiving end does not exist/i;

/** Popup side: asks the content script in a tab to capture a fixture. */
export async function requestCapture({
  tabId,
  sendMessage,
}: {
  tabId: number | undefined;
  sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
}): Promise<CaptureResult> {
  if (tabId === undefined) return { ok: false, message: 'No active tab' };

  let response: unknown;
  try {
    response = await sendMessage(tabId, { type: CAPTURE_FIXTURE_MESSAGE });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: NO_RECEIVER.test(message) ? 'Open a trade2 search page and reload it' : message,
    };
  }

  return isCaptureResult(response) ? response : { ok: false, message: 'The page did not answer' };
}

type MessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined;

/** Content script side: answers capture requests. Returns an unsubscribe function. */
export function listenForCapture(
  onMessage: { addListener(listener: MessageListener): void; removeListener(listener: MessageListener): void },
  capture: () => Promise<CaptureResult>,
): () => void {
  const listener: MessageListener = (message, _sender, sendResponse) => {
    if ((message as { type?: unknown } | null)?.type !== CAPTURE_FIXTURE_MESSAGE) return undefined;
    capture()
      .catch((error: unknown): CaptureResult => ({ ok: false, message: error instanceof Error ? error.message : String(error) }))
      .then(sendResponse);
    // Keeps the message channel open for the async response.
    return true;
  };
  onMessage.addListener(listener);
  return () => onMessage.removeListener(listener);
}

function isCaptureResult(value: unknown): value is CaptureResult {
  return typeof value === 'object' && value !== null && typeof (value as { ok?: unknown }).ok === 'boolean';
}
