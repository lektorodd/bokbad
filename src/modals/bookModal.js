import API from '../api.js';
import BookManager from '../bookManager.js';
import { t } from '../i18n.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, sanitizeImageUrl } from '../utils/escapeHtml.js';
import { GENRE_HIERARCHY, normalizeGenres } from '../utils/genre.js';
import { renderTagChips, setupTagAutocomplete } from '../components/tagAutocomplete.js';
import { populateSeriesDropdown, createNewSeries } from '../components/series.js';
import { openScanner, closeScanner } from '../components/scanner.js';
import {
  handleTitleLookup,
  acceptLookupSuggestion,
  dismissLookupSuggestion,
  fetchBookMetadata,
  resetLookupState,
} from '../components/isbnLookup.js';
import { getGenreLabel } from '../views/home.js';
import { debounce } from '../utils/debounce.js';

// ============ Book Modal State ============
let currentUploadedCoverUrl = null;
let currentGenres = [];
let currentTopics = [];
let currentAuthors = [];

/**
 * Get the book modal form state for use by other modules
 * @returns {Object}
 */
function getFormState() {
  return {
    currentUploadedCoverUrl,
    currentAuthors,
    currentTopics,
    currentGenres,
    setCurrentUploadedCoverUrl: (v) => {
      currentUploadedCoverUrl = v;
    },
    setCurrentAuthors: (v) => {
      currentAuthors = v;
    },
    setCurrentTopics: (v) => {
      currentTopics = v;
    },
    showCoverPreview,
  };
}

function renderGenreSelectGrid(selectedGenres = []) {
  const container = document.getElementById('genre-select-grid');
  if (!container) return;

  let html = '';
  // Fiction section
  html += `<div class="genre-group-label">${escapeHtml(getGenreLabel('fiction'))}</div>`;
  html += `<div class="genre-group">`;
  html += GENRE_HIERARCHY.fiction
    .map((key) => {
      const selected = selectedGenres.includes(key) ? ' selected' : '';
      return `<button type="button" class="genre-chip-option${selected}" data-genre="${key}">${escapeHtml(getGenreLabel(key))}</button>`;
    })
    .join('');
  html += `</div>`;

  // Non-fiction section
  html += `<div class="genre-group-label">${escapeHtml(getGenreLabel('nonfiction'))}</div>`;
  html += `<div class="genre-group">`;
  html += GENRE_HIERARCHY.nonfiction
    .map((key) => {
      const selected = selectedGenres.includes(key) ? ' selected' : '';
      return `<button type="button" class="genre-chip-option${selected}" data-genre="${key}">${escapeHtml(getGenreLabel(key))}</button>`;
    })
    .join('');
  html += `</div>`;

  container.innerHTML = html;
  container.querySelectorAll('.genre-chip-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      currentGenres = Array.from(container.querySelectorAll('.genre-chip-option.selected')).map(
        (el) => el.dataset.genre
      );
    });
  });
}

function updateFormatFields(format) {
  const durationGroup = document.getElementById('total-duration-group');
  const currentPageGroup = document.getElementById('current-page-group');
  const currentDurationGroup = document.getElementById('current-duration-group');
  const currentPercentageGroup = document.getElementById('current-percentage-group');
  const totalPagesGroup = document.getElementById('total-pages-group');

  durationGroup.classList.add('hidden');
  currentPageGroup.classList.add('hidden');
  currentDurationGroup.classList.add('hidden');
  currentPercentageGroup.classList.add('hidden');
  totalPagesGroup.classList.add('hidden');

  if (format === 'paper') {
    totalPagesGroup.classList.remove('hidden');
    currentPageGroup.classList.remove('hidden');
  } else if (format === 'audiobook') {
    durationGroup.classList.remove('hidden');
    currentDurationGroup.classList.remove('hidden');
  } else if (format === 'ebook') {
    totalPagesGroup.classList.remove('hidden');
    currentPercentageGroup.classList.remove('hidden');
  }
}

function updateFinishDateInput(precision) {
  const wrapper = document.getElementById('finish-date-input-wrapper');
  const currentInput = document.getElementById('book-finish-date');
  const currentValue = currentInput ? currentInput.value : '';

  let newInput;
  if (precision === 'year') {
    newInput = document.createElement('input');
    newInput.type = 'number';
    newInput.min = '1900';
    newInput.max = '2100';
    newInput.placeholder = new Date().getFullYear().toString();
    newInput.id = 'book-finish-date';
    if (currentValue) {
      newInput.value = currentValue.substring(0, 4);
    }
  } else if (precision === 'month') {
    newInput = document.createElement('input');
    newInput.type = 'month';
    newInput.id = 'book-finish-date';
    if (currentValue && currentValue.length >= 7) {
      newInput.value = currentValue.substring(0, 7);
    } else if (currentValue && currentValue.length === 4) {
      newInput.value = currentValue + '-01';
    }
  } else {
    newInput = document.createElement('input');
    newInput.type = 'date';
    newInput.id = 'book-finish-date';
    if (currentValue && currentValue.length === 10) {
      newInput.value = currentValue;
    }
  }

  wrapper.innerHTML = '';
  wrapper.appendChild(newInput);
}

function showCoverPreview(url) {
  const safeUrl = sanitizeImageUrl(url);
  if (!safeUrl) return;
  const preview = document.getElementById('cover-preview');
  const img = document.getElementById('cover-preview-img');
  img.src = safeUrl;
  preview.classList.remove('hidden');
}

function removeCoverPreview() {
  const preview = document.getElementById('cover-preview');
  preview.classList.add('hidden');
  currentUploadedCoverUrl = null;
}

async function handleCoverUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast(t('toast.fileTooLarge'), 'error');
    e.target.value = '';
    return;
  }

  try {
    const result = await API.uploadCover(file);
    if (result.success) {
      const safeCover = sanitizeImageUrl(result.url);
      if (!safeCover) {
        showToast(t('toast.uploadFailed'), 'error');
        return;
      }
      currentUploadedCoverUrl = safeCover;
      showCoverPreview(safeCover);
    } else {
      showToast(result.error || t('toast.uploadFailed'), 'error');
    }
  } catch (error) {
    showToast(t('toast.uploadFailed'), 'error');
    console.error(error);
  }
}

/**
 * Open the book add/edit modal
 * @param {number|null} [bookId=null]
 */
export function openBookModal(bookId = null) {
  const modal = document.getElementById('book-modal');
  const form = document.getElementById('book-form');
  const title = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('delete-book-btn');

  form.reset();
  currentUploadedCoverUrl = null;
  currentGenres = [];
  currentTopics = [];
  currentAuthors = [];
  resetLookupState();
  document.getElementById('book-lookup-banner').classList.add('hidden');
  removeCoverPreview();
  renderGenreSelectGrid([]);
  renderTagChips(
    'topic-chips',
    () => currentTopics,
    (v) => {
      currentTopics = v;
    }
  );
  renderTagChips(
    'author-chips',
    () => currentAuthors,
    (v) => {
      currentAuthors = v;
    }
  );
  updateFormatFields('paper');
  document.getElementById('book-finish-date-precision').value = 'day';
  updateFinishDateInput('day');
  populateSeriesDropdown();
  document.getElementById('book-series-order').value = '';

  if (bookId) {
    // Edit mode
    const book = BookManager.getBook(bookId);
    if (!book) return;

    title.textContent = t('book.editBook');
    deleteBtn.classList.remove('hidden');

    document.getElementById('book-id').value = book.id;
    document.getElementById('book-name').value = book.name;
    document.getElementById('book-authors').value = '';
    document.getElementById('book-status').value = book.status;
    document.getElementById('book-start-date').value = book.start_date || '';
    const editPrecision = book.finish_date_precision || 'day';
    document.getElementById('book-finish-date-precision').value = editPrecision;
    updateFinishDateInput(editPrecision);
    // Populate the finish date value based on precision
    if (book.finish_date) {
      const fd = book.finish_date; // YYYY-MM-DD
      if (editPrecision === 'year') {
        document.getElementById('book-finish-date').value = fd.substring(0, 4);
      } else if (editPrecision === 'month') {
        document.getElementById('book-finish-date').value = fd.substring(0, 7);
      } else {
        document.getElementById('book-finish-date').value = fd;
      }
    } else {
      document.getElementById('book-finish-date').value = '';
    }
    document.getElementById('book-thoughts').value = book.thoughts || '';
    document.getElementById('book-isbn').value = book.isbn || '';
    document.getElementById('book-format').value = book.format || 'paper';
    document.getElementById('book-total-pages').value = book.total_pages || '';
    const durH = book.total_duration_min ? Math.floor(book.total_duration_min / 60) : '';
    const durM = book.total_duration_min ? book.total_duration_min % 60 : '';
    document.getElementById('book-total-duration-hours').value = durH;
    document.getElementById('book-total-duration-minutes').value = durM;
    // Current progress fields
    document.getElementById('book-current-page').value = book.current_page || '';
    const curDurH = book.current_duration_min ? Math.floor(book.current_duration_min / 60) : '';
    const curDurM = book.current_duration_min ? book.current_duration_min % 60 : '';
    document.getElementById('book-current-duration-hours').value = curDurH;
    document.getElementById('book-current-duration-minutes').value = curDurM;
    document.getElementById('book-current-percentage').value = book.current_percentage || '';
    updateFormatFields(book.format || 'paper');

    currentGenres = normalizeGenres(book.genres || []);
    currentTopics = [...(book.topics || [])];
    currentAuthors = [...(book.authors || [])];
    renderGenreSelectGrid(currentGenres);
    renderTagChips(
      'topic-chips',
      () => currentTopics,
      (v) => {
        currentTopics = v;
      }
    );
    renderTagChips(
      'author-chips',
      () => currentAuthors,
      (v) => {
        currentAuthors = v;
      }
    );

    const safeExistingCover = sanitizeImageUrl(book.cover_image);
    if (safeExistingCover) {
      showCoverPreview(safeExistingCover);
      currentUploadedCoverUrl = safeExistingCover;
    }
    // Series
    populateSeriesDropdown(book.series_id);
    document.getElementById('book-series-order').value = book.series_order || '';

    // Auto-open collapsible sections when they have data
    const detailsSection = form.querySelectorAll('.form-section');
    if (detailsSection.length >= 2) {
      detailsSection[0].open = true;
      if (book.start_date || book.finish_date || book.thoughts) {
        detailsSection[1].open = true;
      }
    }
  } else {
    // Add mode
    document.getElementById('book-id').value = '';
    title.textContent = t('book.addBook');
    deleteBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  // Scroll to top of modal content
  requestAnimationFrame(() => {
    const content = modal.querySelector('.modal-content');
    if (content) content.scrollTop = 0;
  });
}

export function closeBookModal() {
  const modal = document.getElementById('book-modal');
  modal.classList.add('modal-closing');
  modal.addEventListener(
    'animationend',
    () => {
      modal.classList.add('hidden');
      modal.classList.remove('modal-closing');
      document.getElementById('form-error').textContent = '';
      document.getElementById('book-id').value = '';
    },
    { once: true }
  );
}

/**
 * Handle book form submission
 * @param {Event} e
 * @param {Object} callbacks
 * @param {Function} callbacks.renderHome
 * @param {Function} callbacks.renderBooks
 * @param {Function} callbacks.populateFilterDropdowns
 * @param {Function} callbacks.updateFilterTabCounts
 */
export async function handleBookSubmit(e, callbacks) {
  e.preventDefault();

  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  const bookId = document.getElementById('book-id').value;
  const name = document.getElementById('book-name').value.trim();
  const authorsStr = document.getElementById('book-authors').value.trim();
  // Merge any typed text with chip values
  const typedAuthors = authorsStr
    ? authorsStr
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a)
    : [];
  const authors = [...new Set([...currentAuthors, ...typedAuthors])];
  const status = document.getElementById('book-status').value;
  const startDate = document.getElementById('book-start-date').value || null;
  const finishDatePrecision = document.getElementById('book-finish-date-precision').value || 'day';
  const rawFinishDate = document.getElementById('book-finish-date').value || null;
  const finishDate = rawFinishDate;
  const thoughts = document.getElementById('book-thoughts').value.trim() || null;
  const isbn = document.getElementById('book-isbn').value.trim() || null;
  const format = document.getElementById('book-format').value;
  const isAudiobook = format === 'audiobook';
  const totalPages = document.getElementById('book-total-pages').value
    ? parseInt(document.getElementById('book-total-pages').value)
    : null;
  const durationHours = document.getElementById('book-total-duration-hours').value
    ? parseInt(document.getElementById('book-total-duration-hours').value)
    : 0;
  const durationMins = document.getElementById('book-total-duration-minutes').value
    ? parseInt(document.getElementById('book-total-duration-minutes').value)
    : 0;
  const totalDurationMin = durationHours || durationMins ? durationHours * 60 + durationMins : null;

  // Current progress fields
  const currentPage = document.getElementById('book-current-page').value
    ? parseInt(document.getElementById('book-current-page').value)
    : 0;
  const curDurationHours = document.getElementById('book-current-duration-hours').value
    ? parseInt(document.getElementById('book-current-duration-hours').value)
    : 0;
  const curDurationMins = document.getElementById('book-current-duration-minutes').value
    ? parseInt(document.getElementById('book-current-duration-minutes').value)
    : 0;
  const currentDurationMin =
    curDurationHours || curDurationMins ? curDurationHours * 60 + curDurationMins : 0;
  const currentPercentage = document.getElementById('book-current-percentage').value
    ? parseFloat(document.getElementById('book-current-percentage').value)
    : 0;

  const bookData = {
    name,
    authors,
    genres: currentGenres,
    topics: currentTopics,
    status,
    startDate,
    finishDate,
    finishDatePrecision,
    thoughts,
    isbn,
    format,
    isAudiobook,
    totalPages,
    totalDurationMin,
    currentPage,
    currentDurationMin,
    currentPercentage,
    coverImage: currentUploadedCoverUrl,
    seriesId: document.getElementById('book-series').value
      ? parseInt(document.getElementById('book-series').value)
      : null,
    seriesOrder: document.getElementById('book-series-order').value
      ? parseInt(document.getElementById('book-series-order').value)
      : null,
  };

  let result;
  if (bookId) {
    bookData.id = parseInt(bookId);
    result = await BookManager.updateBook(bookData);
  } else {
    result = await BookManager.createBook(bookData);
  }

  if (result.success) {
    closeBookModal();
    showToast(bookId ? t('toast.bookUpdated') : t('toast.bookAdded'), 'success');
    // Re-fetch everything from server to stay in sync
    await BookManager.loadBooks();
    await BookManager.loadTags();
    callbacks.populateFilterDropdowns();
    callbacks.updateFilterTabCounts();
    callbacks.renderHome();
    callbacks.renderBooks();
  } else {
    errorEl.textContent = result.error;
  }
}

/**
 * Handle book deletion
 * @param {Object} callbacks
 */
export async function handleBookDelete(callbacks) {
  const bookId = document.getElementById('book-id').value;
  if (!bookId) return;

  if (!confirm(t('toast.deleteConfirm'))) return;

  const result = await BookManager.deleteBook(parseInt(bookId));

  if (result.success) {
    closeBookModal();
    showToast(t('toast.bookDeleted'), 'info');
    await BookManager.loadBooks();
    callbacks.updateFilterTabCounts();
    callbacks.renderHome();
    callbacks.renderBooks();
  } else {
    document.getElementById('form-error').textContent = result.error;
  }
}

/**
 * Set up book modal event listeners
 * @param {Object} callbacks
 */
export function setupBookModalListeners(_callbacks) {
  // Cover upload
  document.getElementById('book-cover').addEventListener('change', handleCoverUpload);
  document.getElementById('remove-cover-btn').addEventListener('click', removeCoverPreview);

  // Fetch metadata
  document.getElementById('fetch-metadata-btn').addEventListener('click', () => {
    fetchBookMetadata(getFormState());
  });

  // ISBN barcode scanner
  document.getElementById('scan-isbn-btn').addEventListener('click', () => {
    openScanner(() => fetchBookMetadata(getFormState()));
  });
  document.getElementById('scanner-close-btn').addEventListener('click', closeScanner);

  // Title lookup for cover reuse
  document.getElementById('book-name').addEventListener(
    'input',
    debounce(() => handleTitleLookup(getFormState()), 400)
  );
  document.getElementById('lookup-accept-btn').addEventListener('click', () => {
    acceptLookupSuggestion(getFormState());
  });
  document.getElementById('lookup-dismiss-btn').addEventListener('click', dismissLookupSuggestion);

  // Format select — show/hide fields based on format
  document.getElementById('book-format').addEventListener('change', (e) => {
    updateFormatFields(e.target.value);
  });

  // Finish date precision — swap input type
  document.getElementById('book-finish-date-precision').addEventListener('change', (e) => {
    updateFinishDateInput(e.target.value);
  });

  // New series button
  document.getElementById('new-series-btn').addEventListener('click', createNewSeries);

  // Auto-fill author when selecting a series
  document.getElementById('book-series').addEventListener('change', (e) => {
    const seriesId = parseInt(e.target.value);
    if (!seriesId || currentAuthors.length > 0) return;
    const seriesBook = BookManager.books.find(
      (b) => b.series_id === seriesId && b.authors && b.authors.length > 0
    );
    if (seriesBook) {
      currentAuthors = [...seriesBook.authors];
      renderTagChips(
        'author-chips',
        () => currentAuthors,
        (v) => {
          currentAuthors = v;
        }
      );
    }
  });

  // Tag autocomplete
  setupTagAutocomplete(
    'book-topics',
    'topic-suggestions',
    'topic-chips',
    () => currentTopics,
    (val) => {
      currentTopics = val;
    },
    () => BookManager.availableTopics
  );
  setupTagAutocomplete(
    'book-authors',
    'author-suggestions',
    'author-chips',
    () => currentAuthors,
    (val) => {
      currentAuthors = val;
    },
    () => BookManager.availableAuthors
  );
}
