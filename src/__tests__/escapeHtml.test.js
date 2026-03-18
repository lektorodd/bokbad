import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttribute, sanitizeImageUrl } from '../utils/escapeHtml.js';

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('preserves quotes in text content', () => {
    // textContent→innerHTML does not encode quotes (they are only
    // dangerous inside attribute values, not text nodes)
    const result = escapeHtml('"hello"');
    expect(result).toContain('hello');
    // Verify the dangerous characters ARE escaped
    expect(escapeHtml('<">')).toContain('&lt;');
    expect(escapeHtml('<">')).toContain('&gt;');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles XSS payloads', () => {
    const xss = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(xss);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
});

describe('escapeAttribute', () => {
  it('handles null', () => {
    expect(escapeAttribute(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(escapeAttribute(undefined)).toBe('');
  });

  it('escapes values the same as escapeHtml', () => {
    expect(escapeAttribute('<b>')).toBe('&lt;b&gt;');
  });
});

describe('sanitizeImageUrl', () => {
  it('returns empty string for null/undefined/non-string', () => {
    expect(sanitizeImageUrl(null)).toBe('');
    expect(sanitizeImageUrl(undefined)).toBe('');
    expect(sanitizeImageUrl(123)).toBe('');
  });

  it('returns empty string for empty/whitespace string', () => {
    expect(sanitizeImageUrl('')).toBe('');
    expect(sanitizeImageUrl('   ')).toBe('');
  });

  it('allows relative URLs starting with /', () => {
    expect(sanitizeImageUrl('/uploads/cover.jpg')).toBe('/uploads/cover.jpg');
  });

  it('allows https URLs', () => {
    const url = 'https://example.com/image.jpg';
    expect(sanitizeImageUrl(url)).toBe(url);
  });

  it('allows http URLs', () => {
    const url = 'http://example.com/image.jpg';
    expect(sanitizeImageUrl(url)).toBe(url);
  });

  it('rejects javascript: protocol', () => {
    expect(sanitizeImageUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects data: protocol', () => {
    expect(sanitizeImageUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeImageUrl('  /uploads/cover.jpg  ')).toBe('/uploads/cover.jpg');
  });
});
