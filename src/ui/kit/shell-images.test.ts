import { expect, it } from 'vitest';
import { SHELL_IMAGES } from './shell-images';
it('inlines the shell pictures', () => { for (const src of Object.values(SHELL_IMAGES)) expect(src.startsWith('data:image/png;base64,')).toBe(true); });
