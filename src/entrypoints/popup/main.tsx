import { render } from 'preact';
import { requestCapture } from '@/lib/dev/capture-messaging';
import { ExportPanel } from './ExportPanel';
import './style.css';

// Dev-only popup. `?tabId=` targets a specific tab when the popup is opened as a page;
// `?dryRun=1` skips the download.
const params = new URLSearchParams(location.search);

async function capture() {
  const tabId = Number(params.get('tabId')) || (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  return requestCapture({ tabId, sendMessage: (id, message) => browser.tabs.sendMessage(id, message) });
}

function save(fileName: string, content: string) {
  if (params.has('dryRun')) return;
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function DevTools() {
  return <ExportPanel capture={capture} save={save} />;
}

render(<DevTools />, document.getElementById('app')!);
