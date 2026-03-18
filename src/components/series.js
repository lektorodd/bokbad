import API from '../api.js';
import { t } from '../i18n.js';
import { showToast } from './toast.js';

let availableSeries = [];

/**
 * Load the series list from the API
 * @returns {Promise<void>}
 */
export async function loadSeriesList() {
  try {
    const result = await API.getSeries();
    if (result.success) {
      availableSeries = result.series || [];
    }
  } catch (e) {
    console.error('Failed to load series:', e);
  }
}

/**
 * Get the current series list
 * @returns {Array}
 */
export function getSeriesList() {
  return availableSeries;
}

/**
 * Populate the series dropdown select element
 * @param {number|null} [selectedId=null] - Series ID to pre-select
 */
export function populateSeriesDropdown(selectedId = null) {
  const select = document.getElementById('book-series');
  select.innerHTML = '<option value="">' + t('book.noSeries') + '</option>';
  availableSeries.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name + (s.totalBooks ? ` (${s.bookCount}/${s.totalBooks})` : '');
    if (selectedId && s.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * Create a new series via prompt dialogs
 * @returns {Promise<void>}
 */
export async function createNewSeries() {
  const name = prompt(t('toast.seriesNamePrompt'));
  if (!name || !name.trim()) return;

  const totalStr = prompt(t('toast.seriesTotalPrompt'));
  const totalBooks = totalStr ? parseInt(totalStr) : null;

  try {
    const result = await API.createSeries(name.trim(), totalBooks);
    if (result.success) {
      availableSeries.push(result.series);
      populateSeriesDropdown(result.series.id);
      showToast(t('toast.seriesCreated'), 'success');
    }
  } catch (_e) {
    showToast(t('toast.seriesFailed'), 'error');
  }
}
