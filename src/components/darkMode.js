import { t } from '../i18n.js';

const MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
const SUN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

/**
 * Initialize dark mode from saved preference or system setting
 */
export function initDarkMode() {
  const saved = localStorage.getItem('bokbad-dark-mode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved === 'true' : prefersDark;
  applyDarkMode(isDark);

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('bokbad-dark-mode') === null) {
      applyDarkMode(e.matches);
    }
  });
}

/**
 * Apply dark mode state to the DOM
 * @param {boolean} isDark
 */
export function applyDarkMode(isDark) {
  document.documentElement.classList.toggle('dark-mode', isDark);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    const icon = btn.querySelector('.dropdown-icon');
    if (icon) icon.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    const label = btn.querySelector('[data-i18n]');
    if (label) {
      label.setAttribute('data-i18n', isDark ? 'menu.lightMode' : 'menu.darkMode');
      label.textContent = t(isDark ? 'menu.lightMode' : 'menu.darkMode');
    }
  }
}

/**
 * Toggle dark mode on/off
 */
export function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark-mode');
  localStorage.setItem('bokbad-dark-mode', isDark);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    const icon = btn.querySelector('.dropdown-icon');
    if (icon) icon.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    const label = btn.querySelector('[data-i18n]');
    if (label) {
      label.setAttribute('data-i18n', isDark ? 'menu.lightMode' : 'menu.darkMode');
      label.textContent = t(isDark ? 'menu.lightMode' : 'menu.darkMode');
    }
  }
}
