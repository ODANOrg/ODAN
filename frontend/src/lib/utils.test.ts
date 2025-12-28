import { describe, it, expect } from 'vitest';
import { cn, formatDuration, formatDateTime } from './utils';

describe('utils', () => {
  it('merges class names', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('formats duration in hours/minutes', () => {
    expect(formatDuration(3665)).toBe('1h 1m');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(42)).toBe('42s');
  });

  it('formats date time consistently', () => {
    const iso = '2024-01-02T15:30:00Z';
    const formatted = formatDateTime(iso, 'en');
    expect(formatted).toContain('2024');
  });
});
