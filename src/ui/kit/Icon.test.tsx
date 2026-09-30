import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { iconRegistry, type IconName } from './icon-registry';

describe('Icon', () => {
  it('is decorative without a title', () => {
    const { container } = render(<Icon name="fire" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
  });

  it('is an image with a label when titled', () => {
    const { getByRole } = render(<Icon name="warning" title="Warning" size={16} />);
    const svg = getByRole('img', { name: 'Warning' });
    expect(svg.getAttribute('aria-hidden')).toBeNull();
    expect(svg.getAttribute('width')).toBe('16');
  });

  it('draws every registered icon', () => {
    const names = Object.keys(iconRegistry) as IconName[];
    expect(names.length).toBeGreaterThanOrEqual(48);
    for (const name of names) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg')!.children.length, name).toBeGreaterThan(0);
      unmount();
    }
  });
});
