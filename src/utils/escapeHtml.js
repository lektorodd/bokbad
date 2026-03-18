/**
 * Escape HTML special characters in a string.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape a value for use in an HTML attribute. Handles null/undefined.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function escapeAttribute(value) {
  return escapeHtml(value ?? '');
}

/**
 * Sanitize a URL for use as an image src. Rejects non-HTTP protocols.
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '';
  }

  return '';
}
