import { describe, it, expect } from 'vitest';
import {
  GENRE_HIERARCHY,
  PREDEFINED_GENRES,
  normalizeGenreKey,
  normalizeGenres
} from '../utils/genre.js';

describe('GENRE_HIERARCHY', () => {
  it('has fiction and nonfiction categories', () => {
    expect(GENRE_HIERARCHY).toHaveProperty('fiction');
    expect(GENRE_HIERARCHY).toHaveProperty('nonfiction');
    expect(Array.isArray(GENRE_HIERARCHY.fiction)).toBe(true);
    expect(Array.isArray(GENRE_HIERARCHY.nonfiction)).toBe(true);
  });

  it('PREDEFINED_GENRES is the union of fiction + nonfiction', () => {
    const expected = [...GENRE_HIERARCHY.fiction, ...GENRE_HIERARCHY.nonfiction];
    expect(PREDEFINED_GENRES).toEqual(expected);
  });
});

describe('normalizeGenreKey', () => {
  it('passes through predefined genre keys', () => {
    expect(normalizeGenreKey('novel')).toBe('novel');
    expect(normalizeGenreKey('biography')).toBe('biography');
    expect(normalizeGenreKey('fantasy')).toBe('fantasy');
  });

  it('is case-insensitive', () => {
    expect(normalizeGenreKey('NOVEL')).toBe('novel');
    expect(normalizeGenreKey('Fantasy')).toBe('fantasy');
  });

  it('trims whitespace', () => {
    expect(normalizeGenreKey('  thriller  ')).toBe('thriller');
  });

  it('maps English label variants', () => {
    expect(normalizeGenreKey('sci-fi')).toBe('scifi');
    expect(normalizeGenreKey('non-fiction')).toBe('nonfiction');
    expect(normalizeGenreKey('self-help')).toBe('selfhelp');
    expect(normalizeGenreKey("children's")).toBe('children');
    expect(normalizeGenreKey('young adult')).toBe('ya');
    expect(normalizeGenreKey('graphic novel')).toBe('graphic');
    expect(normalizeGenreKey('humour')).toBe('humor');
  });

  it('maps Norwegian labels', () => {
    expect(normalizeGenreKey('skjønnlitteratur')).toBe('fiction');
    expect(normalizeGenreKey('sakprosa')).toBe('nonfiction');
    expect(normalizeGenreKey('biografi')).toBe('biography');
    expect(normalizeGenreKey('roman')).toBe('novel');
    expect(normalizeGenreKey('krim')).toBe('mystery');
    expect(normalizeGenreKey('barnebøker')).toBe('children');
    expect(normalizeGenreKey('klassiker')).toBe('classic');
    expect(normalizeGenreKey('mat og drikke')).toBe('cooking');
  });

  it('returns unknown genres as-is (lowercased)', () => {
    expect(normalizeGenreKey('Steampunk')).toBe('steampunk');
    expect(normalizeGenreKey('  UNKNOWN  ')).toBe('unknown');
  });
});

describe('normalizeGenres', () => {
  it('returns empty array for null/undefined/non-array', () => {
    expect(normalizeGenres(null)).toEqual([]);
    expect(normalizeGenres(undefined)).toEqual([]);
    expect(normalizeGenres('not-array')).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(normalizeGenres([])).toEqual([]);
  });

  it('normalizes and deduplicates genres', () => {
    const result = normalizeGenres(['Novel', 'novel', 'NOVEL']);
    expect(result).toEqual(['novel']);
  });

  it('strips parent genre categories (fiction, nonfiction)', () => {
    const result = normalizeGenres(['fiction', 'novel', 'nonfiction', 'biography']);
    expect(result).toEqual(['novel', 'biography']);
  });

  it('maps mixed English and Norwegian labels', () => {
    const result = normalizeGenres(['krim', 'sci-fi', 'Roman']);
    expect(result).toEqual(['mystery', 'scifi', 'novel']);
  });

  it('preserves unknown genres', () => {
    const result = normalizeGenres(['steampunk', 'novel']);
    expect(result).toEqual(['steampunk', 'novel']);
  });
});
