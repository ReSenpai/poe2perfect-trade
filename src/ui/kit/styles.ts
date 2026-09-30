import capMagic from './assets/frames/header-cap-magic.svg?raw';
import capNormal from './assets/frames/header-cap-normal.svg?raw';
import capRare from './assets/frames/header-cap-rare.svg?raw';
import capUnique from './assets/frames/header-cap-unique.svg?raw';
import modDivider from './assets/frames/mod-divider.svg?raw';
import { inlineCssUrls } from './css';
import componentsCss from './styles/components.css?raw';
import layoutCss from './styles/layout.css?raw';
import tokensCss from './styles/tokens.css?raw';

const FRAMES = {
  '../assets/frames/header-cap-normal.svg': capNormal,
  '../assets/frames/header-cap-magic.svg': capMagic,
  '../assets/frames/header-cap-rare.svg': capRare,
  '../assets/frames/header-cap-unique.svg': capUnique,
  '../assets/frames/mod-divider.svg': modDivider,
};

/** CSS of the v4 redesign kit (tokens → components → layout), with its frame SVGs embedded. */
export const V4_CSS = inlineCssUrls([tokensCss, componentsCss, layoutCss].join('\n'), FRAMES);
