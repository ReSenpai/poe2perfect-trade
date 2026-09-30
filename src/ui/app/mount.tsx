import { render } from 'preact';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { V4_CSS } from '@/ui/kit/styles';
import { BASE_CSS } from '@/ui/styles';
import { registerFonts } from '@/ui/theme/fonts';
import { INTER_SOURCES } from '@/ui/theme/inter-sources';
import v4Css from '@/ui/v4/v4.css?inline';
import appCss from './app.css?inline';
import { ConnectedApp, type ConnectedAppProps } from './App';

/** Mounts the extension UI in an isolated shadow root at the end of the page body; returns the shadow host. */
export async function mountApp(ctx: ContentScriptContext, props: ConnectedAppProps): Promise<HTMLElement> {
  registerFonts({ fontSet: document.fonts, FontFace, sources: INTER_SOURCES });
  const ui = await createShadowRootUi(ctx, {
    name: 'poe2perfect-trade',
    css: `${BASE_CSS}\n${appCss}\n${V4_CSS}\n${v4Css}`,
    position: 'inline',
    anchor: 'body',
    // Keep typing inside the UI from triggering the site's keyboard shortcuts.
    isolateEvents: true,
    onMount: (container) => {
      render(<ConnectedApp {...props} />, container);
      return container;
    },
    onRemove: (container) => {
      if (container) render(null, container);
    },
  });
  ui.mount();
  return ui.shadowHost;
}
