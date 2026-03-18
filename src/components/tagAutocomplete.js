import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Set up tag autocomplete on an input field
 * @param {string} inputId - Input element ID
 * @param {string} suggestionsId - Suggestions dropdown ID
 * @param {string} chipsId - Chips container ID
 * @param {Function} getValues - Returns current tag values array
 * @param {Function} setValues - Sets tag values array
 * @param {Function|string[]} getSuggestions - Returns or is the suggestions array
 */
export function setupTagAutocomplete(
  inputId,
  suggestionsId,
  chipsId,
  getValues,
  setValues,
  getSuggestions
) {
  const input = document.getElementById(inputId);
  const suggestionsEl = document.getElementById(suggestionsId);

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      suggestionsEl.classList.add('hidden');
      return;
    }

    const currentVals = getValues();
    const suggestions = typeof getSuggestions === 'function' ? getSuggestions() : getSuggestions;
    const matches = suggestions.filter(
      (s) =>
        s.toLowerCase().includes(query) &&
        !currentVals.some((v) => v.toLowerCase() === s.toLowerCase())
    );

    if (matches.length === 0) {
      suggestionsEl.classList.add('hidden');
      return;
    }

    suggestionsEl.innerHTML = matches
      .map(
        (m) =>
          `<div class="tag-suggestion-item" data-value="${escapeHtml(m)}">${escapeHtml(m)}</div>`
      )
      .join('');
    suggestionsEl.classList.remove('hidden');

    // Click on suggestion
    suggestionsEl.querySelectorAll('.tag-suggestion-item').forEach((item) => {
      item.addEventListener('click', () => {
        const vals = getValues();
        vals.push(item.dataset.value);
        setValues(vals);
        renderTagChips(chipsId, getValues, setValues);
        input.value = '';
        suggestionsEl.classList.add('hidden');
      });
    });
  });

  // Enter key to add custom tag
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        const vals = getValues();
        if (!vals.some((v) => v.toLowerCase() === val.toLowerCase())) {
          vals.push(val);
          setValues(vals);
          renderTagChips(chipsId, getValues, setValues);
        }
        input.value = '';
        suggestionsEl.classList.add('hidden');
      }
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${suggestionsId}`)) {
      suggestionsEl.classList.add('hidden');
    }
  });
}

/**
 * Render tag chips with remove buttons
 * @param {string} chipsId - Container element ID
 * @param {Function} getValues - Returns current tag values array
 * @param {Function} setValues - Sets tag values array
 */
export function renderTagChips(chipsId, getValues, setValues) {
  const container = document.getElementById(chipsId);
  const values = getValues();
  container.innerHTML = values
    .map(
      (val, i) =>
        `<span class="tag-chip">${escapeHtml(val)}<button type="button" class="tag-chip-remove" data-index="${i}">×</button></span>`
    )
    .join('');

  container.querySelectorAll('.tag-chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const vals = getValues();
      vals.splice(idx, 1);
      setValues(vals);
      renderTagChips(chipsId, getValues, setValues);
    });
  });
}
