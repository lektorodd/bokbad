import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateRelative, formatDuration } from '../utils/format.js';

// Mock i18n — these functions are imported by format.js
vi.mock('../i18n.js', () => ({
  t: (key, params) => {
    const translations = {
      'time.today': 'I dag',
      'time.yesterday': 'I går',
      'time.h': 't',
      'time.m': 'm'
    };
    if (key === 'time.daysAgo') return `${params.count} dager siden`;
    return translations[key] ?? key;
  },
  getLocale: () => 'no'
}));

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('returns the raw string for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('formats with year precision', () => {
    expect(formatDate('2025-06-15', 'year')).toBe('2025');
  });

  it('formats with month precision', () => {
    const result = formatDate('2025-06-15', 'month');
    // Intl with 'nb' locale: "juni 2025" or "jun. 2025"
    expect(result).toContain('2025');
  });

  it('formats with day precision (default)', () => {
    const result = formatDate('2025-06-15');
    expect(result).toContain('2025');
    expect(result).toContain('15');
  });
});

describe('formatDateRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns empty string for falsy input', () => {
    expect(formatDateRelative('')).toBe('');
    expect(formatDateRelative(null)).toBe('');
  });

  it('returns the raw string for invalid dates', () => {
    expect(formatDateRelative('garbage')).toBe('garbage');
  });

  it('returns "I dag" for today', () => {
    vi.setSystemTime(new Date('2025-06-15T14:00:00'));
    expect(formatDateRelative('2025-06-15')).toBe('I dag');
  });

  it('returns "I går" for yesterday', () => {
    vi.setSystemTime(new Date('2025-06-15T14:00:00'));
    expect(formatDateRelative('2025-06-14')).toBe('I går');
  });

  it('returns "N dager siden" for 2-7 days ago', () => {
    vi.setSystemTime(new Date('2025-06-15T14:00:00'));
    expect(formatDateRelative('2025-06-12')).toBe('3 dager siden');
  });

  it('falls back to formatted date for >7 days ago', () => {
    vi.setSystemTime(new Date('2025-06-15T14:00:00'));
    const result = formatDateRelative('2025-06-01');
    // Should be a formatted date, not a relative string
    expect(result).toContain('2025');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('formatDuration', () => {
  it('returns "0t 0m" for zero / falsy input', () => {
    expect(formatDuration(0)).toBe('0t 0m');
    expect(formatDuration(null)).toBe('0t 0m');
    expect(formatDuration(undefined)).toBe('0t 0m');
  });

  it('formats minutes only (< 60)', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(125)).toBe('2t 5m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(120)).toBe('2t 0m');
  });
});
