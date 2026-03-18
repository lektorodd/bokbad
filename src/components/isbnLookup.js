import API from '../api.js';
import { t } from '../i18n.js';
import { showToast } from './toast.js';
import { renderTagChips } from './tagAutocomplete.js';
import { sanitizeImageUrl } from '../utils/escapeHtml.js';

let lookupDismissed = false;
let pendingLookupResult = null;

/**
 * Reset lookup state (called when opening book modal)
 */
export function resetLookupState() {
  lookupDismissed = false;
  pendingLookupResult = null;
}

/**
 * Handle title lookup for cover reuse
 * @param {Object} state - Shared form state
 * @param {string|null} state.currentUploadedCoverUrl
 * @param {Function} state.showCoverPreview
 */
export async function handleTitleLookup(state) {
  const name = document.getElementById('book-name').value.trim();
  const bookId = document.getElementById('book-id').value;
  const banner = document.getElementById('book-lookup-banner');

  // Skip in edit mode, if dismissed, if cover already set, or if name too short
  if (bookId || lookupDismissed || state.currentUploadedCoverUrl || name.length < 3) {
    banner.classList.add('hidden');
    return;
  }

  try {
    const result = await API.lookupBook(name);
    if (result.success && result.book && result.book.coverImage) {
      pendingLookupResult = result.book;
      const lookupCover = sanitizeImageUrl(result.book.coverImage);
      if (!lookupCover) {
        banner.classList.add('hidden');
        pendingLookupResult = null;
        return;
      }
      document.getElementById('lookup-banner-img').src = lookupCover;
      document.getElementById('lookup-banner-title').textContent = result.book.title;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
      pendingLookupResult = null;
    }
  } catch {
    banner.classList.add('hidden');
    pendingLookupResult = null;
  }
}

/**
 * Accept the lookup suggestion — apply cover, authors, pages, ISBN
 * @param {Object} state - Shared form state
 * @param {Function} state.setCurrentUploadedCoverUrl
 * @param {Function} state.showCoverPreview
 * @param {string[]} state.currentAuthors - Mutable reference
 * @param {Function} state.setCurrentAuthors
 */
export function acceptLookupSuggestion(state) {
  if (!pendingLookupResult) return;

  const book = pendingLookupResult;

  // Set cover
  if (book.coverImage) {
    const safeCover = sanitizeImageUrl(book.coverImage);
    if (safeCover) {
      state.setCurrentUploadedCoverUrl(safeCover);
      state.showCoverPreview(safeCover);
    }
  }

  // Auto-fill authors if empty
  if (book.authors && book.authors.length > 0 && state.currentAuthors.length === 0) {
    state.setCurrentAuthors([...book.authors]);
    renderTagChips(
      'author-chips',
      () => state.currentAuthors,
      (v) => {
        state.setCurrentAuthors(v);
      }
    );
    document.getElementById('book-authors').value = '';
  }

  // Auto-fill total pages if empty
  if (book.totalPages && !document.getElementById('book-total-pages').value) {
    document.getElementById('book-total-pages').value = book.totalPages;
  }

  // Auto-fill ISBN if empty
  if (book.isbn && !document.getElementById('book-isbn').value) {
    document.getElementById('book-isbn').value = book.isbn;
  }

  // Hide banner
  document.getElementById('book-lookup-banner').classList.add('hidden');
  pendingLookupResult = null;
}

/**
 * Dismiss the lookup suggestion
 */
export function dismissLookupSuggestion() {
  lookupDismissed = true;
  document.getElementById('book-lookup-banner').classList.add('hidden');
  pendingLookupResult = null;
}

/**
 * Fetch book metadata by ISBN and populate form fields
 * @param {Object} state - Shared form state
 * @param {Function} state.setCurrentUploadedCoverUrl
 * @param {Function} state.showCoverPreview
 * @param {string[]} state.currentAuthors
 * @param {Function} state.setCurrentAuthors
 * @param {string[]} state.currentTopics
 * @param {Function} state.setCurrentTopics
 */
export async function fetchBookMetadata(state) {
  let isbn = document.getElementById('book-isbn').value.trim();
  // Strip dashes and spaces
  isbn = isbn.replace(/[-\s]/g, '');

  if (!isbn) {
    showToast(t('toast.enterISBN'), 'warning');
    return;
  }

  // Basic ISBN validation
  if (!/^(\d{10}|\d{13})$/.test(isbn)) {
    showToast(t('toast.isbnInvalid'), 'warning');
    return;
  }

  // Update the cleaned ISBN in the field
  document.getElementById('book-isbn').value = isbn;

  const btn = document.getElementById('fetch-metadata-btn');
  btn.textContent = t('book.fetching');
  btn.disabled = true;

  try {
    const result = await API.fetchMetadata(isbn);
    if (result.success && result.metadata) {
      const meta = result.metadata;

      if (meta.title) {
        document.getElementById('book-name').value = meta.title;
      }
      if (meta.authors && meta.authors.length > 0) {
        state.setCurrentAuthors([...meta.authors]);
        renderTagChips(
          'author-chips',
          () => state.currentAuthors,
          (v) => {
            state.setCurrentAuthors(v);
          }
        );
        document.getElementById('book-authors').value = '';
      }
      if (meta.categories && meta.categories.length > 0) {
        state.setCurrentTopics([...new Set([...state.currentTopics, ...meta.categories])]);
        renderTagChips(
          'topic-chips',
          () => state.currentTopics,
          (v) => {
            state.setCurrentTopics(v);
          }
        );
      }
      if (meta.pageCount) {
        document.getElementById('book-total-pages').value = meta.pageCount;
      }
      if (meta.coverImage) {
        // Cache the remote cover image locally to avoid lag on every page load
        try {
          const proxyResult = await API.proxyCover(meta.coverImage);
          if (proxyResult.success && proxyResult.url) {
            state.setCurrentUploadedCoverUrl(proxyResult.url);
            state.showCoverPreview(proxyResult.url);
          } else {
            // Fallback to remote URL if proxy fails
            const safeCover = sanitizeImageUrl(meta.coverImage);
            if (safeCover) {
              state.setCurrentUploadedCoverUrl(safeCover);
              state.showCoverPreview(safeCover);
            }
          }
        } catch {
          // Fallback to remote URL
          const safeCover = sanitizeImageUrl(meta.coverImage);
          if (safeCover) {
            state.setCurrentUploadedCoverUrl(safeCover);
            state.showCoverPreview(safeCover);
          }
        }
      }
      showToast(t('toast.bookDetailsLoaded'), 'success');
    } else {
      showToast(result.error || t('toast.bookNotFound'), 'warning');
    }
  } catch (error) {
    showToast(t('toast.metadataFailed'), 'error');
    console.error(error);
  } finally {
    btn.textContent = t('book.fetch');
    btn.disabled = false;
  }
}
