import { t, getLocale } from '../i18n.js';

/**
 * Format a date string with the given precision level.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @param {'day'|'month'|'year'} [precision='day']
 * @returns {string}
 */
export function formatDate(dateStr, precision = 'day') {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const locale = getLocale() === 'no' ? 'nb' : getLocale();
    if (precision === 'year') {
      return date.getFullYear().toString();
    }
    if (precision === 'month') {
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
    }
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string as a relative time (e.g. "today", "yesterday", "3 days ago").
 * Falls back to formatDate() for dates older than 7 days.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
export function formatDateRelative(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('time.today');
    if (diffDays === 1) return t('time.yesterday');
    if (diffDays <= 7) return t('time.daysAgo', { count: diffDays });
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

/**
 * Format a duration in minutes to a human-readable string (e.g. "2h 30m").
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatDuration(totalMinutes) {
  if (!totalMinutes) return `0${t('time.h')} 0${t('time.m')}`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}${t('time.h')} ${m}${t('time.m')}` : `${m}${t('time.m')}`;
}
