import BookManager from '../bookManager.js';
import { t } from '../i18n.js';
import { escapeHtml, escapeAttribute, sanitizeImageUrl } from '../utils/escapeHtml.js';
import { GENRE_HIERARCHY } from '../utils/genre.js';
import { getGenreLabel } from './home.js';

/**
 * Render the library book list
 * @param {Object} callbacks
 * @param {Function} callbacks.openDetailModal
 * @param {Function} callbacks.attachSwipeHandlers
 */
export function renderBooks(callbacks) {
  const container = document.getElementById('books-container');
  const books = BookManager.getFilteredBooks();

  if (books.length === 0) {
    const hasFilters =
      BookManager.currentSearch ||
      BookManager.currentFilter.length > 0 ||
      BookManager.currentGenreFilter ||
      BookManager.currentTopicFilter ||
      BookManager.currentAuthorFilter ||
      BookManager.currentAudiobookFilter !== 'all';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${hasFilters ? '🔍' : '📚'}</div>
        <p>${hasFilters ? t('library.noMatches') : t('library.emptyLibrary')}</p>
        ${hasFilters ? '' : `<button class="btn btn-primary" onclick="document.getElementById('add-book-btn').click()">${t('library.addBook')}</button>`}
      </div>
    `;
    return;
  }

  container.innerHTML = books.map((book) => createBookCard(book)).join('');

  // Add click listeners — opens detail view (on inner content only to avoid swipe conflicts)
  container.querySelectorAll('.book-card').forEach((card) => {
    const clickTarget = card.querySelector('.book-card-inner') || card;
    clickTarget.addEventListener('click', (_e) => {
      // Don't open if we just finished swiping
      if (
        clickTarget.style.transform &&
        clickTarget.style.transform !== 'translateX(0px)' &&
        clickTarget.style.transform !== 'translateX(0)'
      )
        return;
      const bookId = parseInt(card.dataset.bookId);
      callbacks.openDetailModal(bookId);
    });
  });

  // Attach swipe handlers
  callbacks.attachSwipeHandlers(container);
}

function createBookCard(book) {
  const statusLabel = {
    'want-to-read': t('status.wantToRead'),
    'up-next': t('status.upNext'),
    reading: t('status.reading'),
    read: t('status.read'),
  }[book.status];

  const safeCover = sanitizeImageUrl(book.cover_image);
  const coverImg = safeCover
    ? `<img src="${escapeAttribute(safeCover)}" alt="${escapeHtml(book.name)}" class="book-cover" />`
    : `<div class="book-cover-placeholder">📖</div>`;

  // Format overlay badge on cover
  let formatOverlay = '';
  if (book.format === 'audiobook') {
    formatOverlay = '<span class="cover-format-badge">🎧</span>';
  } else if (book.format === 'ebook') {
    formatOverlay = '<span class="cover-format-badge">📱</span>';
  }

  const coverHtml = `<div class="book-cover-wrap">${coverImg}${formatOverlay}</div>`;

  const authorsHtml =
    book.authors && book.authors.length > 0
      ? `<div class="book-authors">${escapeHtml(book.authors.join(', '))}</div>`
      : '';

  const genresHtml =
    book.genres && book.genres.length > 0
      ? book.genres
          .map((g) => `<span class="tag tag-genre">${escapeHtml(getGenreLabel(g))}</span>`)
          .join('')
      : '';

  const topicsHtml =
    book.topics && book.topics.length > 0
      ? book.topics.map((tp) => `<span class="tag tag-topic">${escapeHtml(tp)}</span>`).join('')
      : '';

  const tagsHtml =
    genresHtml || topicsHtml ? `<div class="book-tags">${genresHtml}${topicsHtml}</div>` : '';

  // Compact badge (text) for list view
  let compactBadgeHtml = '';
  if (book.format === 'audiobook') {
    compactBadgeHtml = '<span class="compact-format-badge format-audiobook">🎧 Audiobook</span>';
  } else if (book.format === 'ebook') {
    compactBadgeHtml = '<span class="compact-format-badge format-ebook">📱 E-book</span>';
  }

  // Progress bar for reading books
  let progressHtml = '';
  if (book.status === 'reading') {
    let pct = 0;
    if (book.current_percentage) {
      pct = Math.round(book.current_percentage);
    } else if (book.total_pages && book.current_page) {
      pct = Math.round((book.current_page / book.total_pages) * 100);
    } else if (book.total_duration_min && book.current_duration_min) {
      pct = Math.round((book.current_duration_min / book.total_duration_min) * 100);
    }
    if (pct > 0) {
      progressHtml = `<div class="book-progress-bar"><div class="book-progress-fill" style="width:${pct}%"></div></div>`;
    }
  }

  // Series info
  let seriesHtml = '';
  if (book.series_name) {
    seriesHtml = `<span class="book-series-chip">${escapeHtml(book.series_name)}${book.series_order ? ` #${book.series_order}` : ''}</span>`;
  }

  return `
    <div class="book-card" data-book-id="${book.id}" data-status="${book.status}">
      <div class="swipe-action-right"><span>${t('library.swipeLog')}</span></div>
      <div class="swipe-action-left"><span>${t('library.swipeStatus')}</span></div>
      <div class="book-card-inner">
        ${coverHtml}
        <div class="book-info">
          <div class="book-title">${escapeHtml(book.name)}</div>
          ${authorsHtml}
          ${seriesHtml}
          ${compactBadgeHtml}
          ${progressHtml}
          ${tagsHtml}
        </div>
        <span class="book-status ${book.status}">${statusLabel}</span>
      </div>
    </div>
  `;
}

/**
 * Populate genre and topic filter dropdowns
 */
export function populateFilterDropdowns() {
  const genreFilter = document.getElementById('genre-filter');
  const topicFilter = document.getElementById('topic-filter');

  genreFilter.innerHTML =
    `<option value="">${escapeHtml(t('library.allGenres'))}</option>` +
    `<optgroup label="${escapeHtml(getGenreLabel('fiction'))}">` +
    GENRE_HIERARCHY.fiction
      .map((key) => `<option value="${key}">${escapeHtml(getGenreLabel(key))}</option>`)
      .join('') +
    `</optgroup>` +
    `<optgroup label="${escapeHtml(getGenreLabel('nonfiction'))}">` +
    GENRE_HIERARCHY.nonfiction
      .map((key) => `<option value="${key}">${escapeHtml(getGenreLabel(key))}</option>`)
      .join('') +
    `</optgroup>`;

  topicFilter.innerHTML =
    '<option value="">All Topics</option>' +
    BookManager.availableTopics
      .map((tp) => `<option value="${escapeHtml(tp)}">${escapeHtml(tp)}</option>`)
      .join('');
}

/**
 * Render active filter pills with clear buttons
 * @param {Object} callbacks
 * @param {Function} callbacks.renderBooks
 */
export function renderActiveFilterPills(callbacks) {
  const container = document.getElementById('active-filter-pills');
  if (!container) return;

  const pills = [];
  const sortLabels = {
    newest: t('library.newestFirst'),
    'title-az': t('library.titleAZ'),
    'title-za': t('library.titleZA'),
    author: t('library.author'),
    status: t('library.statusSort'),
    progress: t('library.progress'),
    'finish-date': t('library.finishDate'),
  };

  // Search pill
  if (BookManager.currentSearch) {
    pills.push({
      label: `🔍 "${BookManager.currentSearch}"`,
      clear: () => {
        BookManager.setSearch('');
        document.getElementById('search-input').value = '';
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Sort pill (only if not default)
  if (BookManager.currentSort !== 'newest') {
    pills.push({
      label: `↕ ${sortLabels[BookManager.currentSort] || BookManager.currentSort}`,
      clear: () => {
        BookManager.setSort('newest');
        document.getElementById('sort-select').value = 'newest';
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Genre pill
  if (BookManager.currentGenreFilter) {
    pills.push({
      label: `📚 ${getGenreLabel(BookManager.currentGenreFilter)}`,
      clear: () => {
        BookManager.setGenreFilter('');
        document.getElementById('genre-filter').value = '';
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Topic pill
  if (BookManager.currentTopicFilter) {
    pills.push({
      label: `🏷 ${BookManager.currentTopicFilter}`,
      clear: () => {
        BookManager.setTopicFilter('');
        document.getElementById('topic-filter').value = '';
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Format pill
  if (BookManager.currentAudiobookFilter !== 'all') {
    const formatLabels = { paper: '📕 Paper', ebook: '📱 E-book', audiobook: '🎧 Audiobook' };
    pills.push({
      label: formatLabels[BookManager.currentAudiobookFilter] || BookManager.currentAudiobookFilter,
      clear: () => {
        BookManager.setAudiobookFilter('all');
        document.getElementById('audiobook-filter').value = 'all';
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Author pill
  if (BookManager.currentAuthorFilter) {
    pills.push({
      label: `✍ ${BookManager.currentAuthorFilter}`,
      clear: () => {
        BookManager.setAuthorFilter('');
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Series pill
  if (BookManager.currentSeriesFilter) {
    const seriesName = BookManager._seriesFilterName || 'Series';
    pills.push({
      label: `📖 ${seriesName}`,
      clear: () => {
        BookManager.setSeriesFilter(null);
        BookManager._seriesFilterName = null;
        callbacks.renderBooks();
        renderActiveFilterPills(callbacks);
      },
    });
  }

  // Render
  container.innerHTML = pills
    .map(
      (pill, i) =>
        `<span class="filter-pill" data-pill-idx="${i}">${escapeHtml(pill.label)}<button class="filter-pill-remove" data-pill-idx="${i}">×</button></span>`
    )
    .join('');

  // Attach clear handlers
  container.querySelectorAll('.filter-pill-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.pillIdx);
      pills[idx]?.clear();
    });
  });

  // Update filter toggle button indicator
  const toggleBtn = document.getElementById('toggle-extra-filters');
  if (toggleBtn) {
    toggleBtn.classList.toggle('has-active-filters', pills.length > 0);
  }
}

/**
 * Update filter tab counts from BookManager data
 */
export function updateFilterTabCounts() {
  const counts = {
    all: BookManager.books.length,
    'want-to-read': 0,
    'up-next': 0,
    reading: 0,
    read: 0,
  };

  BookManager.books.forEach((book) => {
    if (counts[book.status] !== undefined) {
      counts[book.status]++;
    }
  });

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    const status = tab.dataset.status;
    const label = {
      all: t('library.all'),
      'want-to-read': t('status.wantToRead'),
      'up-next': t('status.upNext'),
      reading: t('status.reading'),
      read: t('status.read'),
    }[status];
    tab.textContent = `${label} (${counts[status]})`;
  });
}

/**
 * Set the book list view mode
 * @param {'compact'|'expanded'|'grid'} viewType
 */
export function setBookView(viewType) {
  const container = document.getElementById('books-container');
  const btnCompact = document.getElementById('view-compact');
  const btnExpanded = document.getElementById('view-expanded');
  const btnGrid = document.getElementById('view-grid');

  container.classList.remove('compact-view', 'expanded-view', 'grid-view');
  container.classList.add(`${viewType}-view`);

  btnCompact.classList.toggle('active', viewType === 'compact');
  btnExpanded.classList.toggle('active', viewType === 'expanded');
  btnGrid.classList.toggle('active', viewType === 'grid');

  localStorage.setItem('bokbad_view_pref', viewType);
}

/**
 * Load and apply saved view preference
 */
export function loadViewPreference() {
  const pref = localStorage.getItem('bokbad_view_pref') || 'compact';
  setBookView(pref);
}
