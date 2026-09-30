import { readFileSync } from 'node:fs';
import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { FilterIcon } from './FilterIcon';

describe('FilterIcon', () => {
  it('draws the Lucide standard: 20 px, stroke 1.75, decorative', () => {
    const { container } = render(<FilterIcon iconKey="itemLevel" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('stroke-width')).toBe('1.75');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('data-icon')).toBe('itemLevel');
    expect(svg.getAttribute('data-tone')).toBeNull();
  });

  it('colours an attribute by its tone, the same for the bonus and the requirement', () => {
    for (const key of ['strength', 'dexterity', 'intelligence'] as const) {
      const { container } = render(<FilterIcon iconKey={key} />);
      expect(container.querySelector('svg')!.getAttribute('data-tone')).toBe(key);
    }
  });

  it('ships the notices of Lucide with the extension', () => {
    const notices = readFileSync('public/THIRD_PARTY_NOTICES.txt', 'utf8');
    expect(notices).toMatch(/lucide-preact 1\.47\.0/);
    expect(notices).toMatch(/ISC License/);
    expect(notices).toMatch(/Feather/);
  });
});
