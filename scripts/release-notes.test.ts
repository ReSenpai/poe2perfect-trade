import { describe, expect, it } from 'vitest';
import { releaseNotes } from './release-notes.mjs';

const CHANGELOG = `# Changelog

## Unreleased

- Next thing.

## 1.1.0-beta.1

A beta for testers.

- One.
- Two.

## 1.0.0

The first release.
`;

describe('releaseNotes', () => {
  it('takes the section of the version, without its heading', () => {
    expect(releaseNotes(CHANGELOG, '1.1.0-beta.1')).toBe('A beta for testers.\n\n- One.\n- Two.');
    expect(releaseNotes(CHANGELOG, '1.0.0')).toBe('The first release.');
  });

  it('refuses a version the changelog does not describe', () => {
    expect(() => releaseNotes(CHANGELOG, '1.2.0')).toThrow(/CHANGELOG/);
  });
});
