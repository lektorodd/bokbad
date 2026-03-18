import API from '../api.js';
import BookManager from '../bookManager.js';
import { t } from '../i18n.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, escapeAttribute, sanitizeImageUrl } from '../utils/escapeHtml.js';
import { formatDate, formatDateRelative, formatDuration } from '../utils/format.js';
import { getGenreLabel } from '../views/home.js';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

/**
 * Open the detail modal for a book
 * @param {number} bookId
 * @param {Object} callbacks
 * @param {Function} callbacks.navigateToLibraryWithFilter
 * @param {Function} callbacks.openBookModal
 * @param {Function} callbacks.openSessionModal
 */
export function openDetailModal(bookId, callbacks) {
  const book = BookManager.getBook(bookId);
  if (!book) return;

  const modal = document.getElementById('detail-modal');
  modal.dataset.bookId = bookId;

  const statusLabel = {
    'want-to-read': t('status.wantToRead'),
    'up-next': t('status.upNext'),
    reading: t('status.reading'),
    read: t('status.read'),
  }[book.status];

  const safeCover = sanitizeImageUrl(book.cover_image);
  const coverHtml = safeCover
    ? `<img src="${escapeAttribute(safeCover)}" alt="${escapeHtml(book.name)}" class="detail-cover" />`
    : `<div class="detail-cover-placeholder">📖</div>`;

  const authorsText =
    book.authors && book.authors.length > 0
      ? book.authors
          .map(
            (a) =>
              `<span class="detail-author-link" data-author="${escapeHtml(a)}">${escapeHtml(a)}</span>`
          )
          .join(', ')
      : '';

  const formatLabel = { paper: '📕 Paper', ebook: '📱 E-book', audiobook: '🎧 Audio' }[
    book.format || 'paper'
  ];

  // Tags (genres + topics combined inline)
  const allTags = [];
  if (book.genres)
    allTags.push(
      ...book.genres.map(
        (g) =>
          `<span class="tag tag-genre detail-tag-link" data-genre="${escapeHtml(g)}">${escapeHtml(getGenreLabel(g))}</span>`
      )
    );
  if (book.topics)
    allTags.push(
      ...book.topics.map(
        (tp) =>
          `<span class="tag tag-topic detail-tag-link" data-topic="${escapeHtml(tp)}">${escapeHtml(tp)}</span>`
      )
    );
  const tagsHtml =
    allTags.length > 0 ? `<div class="detail-tags-row">${allTags.join('')}</div>` : '';

  // Series
  let seriesHtml = '';
  if (book.series_name) {
    seriesHtml = `<span class="detail-meta-chip detail-series-link" data-series="${escapeHtml(book.series_name)}" data-series-id="${book.series_id}">${escapeHtml(book.series_name)}${book.series_order ? ` #${book.series_order}` : ''}</span>`;
  }

  // Progress
  let progressHtml = '';
  const pct = BookManager.getProgressPercent(book);
  if (pct > 0 || book.total_pages || book.total_duration_min) {
    let progressDetail = '';
    if ((book.format || 'paper') === 'paper' && book.total_pages) {
      progressDetail = `${book.current_page || 0}/${book.total_pages} p. (${pct}%)`;
    } else if (book.format === 'audiobook' && book.total_duration_min) {
      progressDetail = `${formatDuration(book.current_duration_min || 0)} / ${formatDuration(book.total_duration_min)} (${pct}%)`;
    } else if (book.format === 'ebook') {
      progressDetail = `${pct}%`;
    }
    progressHtml = `
      <div class="detail-progress-row">
        <div class="progress-bar-container progress-bar-lg">
          <div class="progress-bar" style="width: ${pct}%"></div>
        </div>
        <span class="progress-label">${progressDetail}</span>
      </div>
    `;
  }

  // Dates inline
  const dateItems = [];
  if (book.start_date) dateItems.push(`📅 ${formatDate(book.start_date)}`);
  if (book.finish_date)
    dateItems.push(`✅ ${formatDate(book.finish_date, book.finish_date_precision || 'day')}`);
  const datesHtml =
    dateItems.length > 0
      ? `<div class="detail-dates">${dateItems.join(' <span class="detail-date-sep">→</span> ')}</div>`
      : '';

  // Notes & Highlights
  const notesContent = book.thoughts ? renderMarkdown(book.thoughts) : '';
  const notesHtml = `
    <div class="detail-notes-section">
      <div class="detail-notes-header">
        <span class="detail-label">📝 Notes & Highlights</span>
        <button class="btn-text detail-notes-edit-btn" data-book-id="${bookId}">${book.thoughts ? 'Edit' : 'Add'}</button>
      </div>
      <div class="detail-notes-content" id="detail-notes-display">
        ${notesContent || '<span class="detail-notes-empty">Tap "Add" to write notes, highlights, or takeaways…</span>'}
      </div>
      <div class="detail-notes-editor hidden" id="detail-notes-editor">
        <textarea id="detail-notes-textarea" class="detail-notes-textarea" placeholder="**Bold**, *italic*, # Heading, - List"></textarea>
        <div class="detail-notes-actions">
          <button class="btn btn-secondary btn-sm detail-notes-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm detail-notes-save" data-book-id="${bookId}">Save</button>
        </div>
      </div>
    </div>
  `;

  // Status badge
  const statusHtml = `<span class="book-status ${book.status} detail-status-badge detail-status-link" data-status="${book.status}" data-book-id="${bookId}" title="${t('library.statusSort')}">${statusLabel}</span>`;

  const body = document.getElementById('detail-body');
  body.innerHTML = `
    <div class="detail-cover-section">
      ${coverHtml}
    </div>
    <div class="detail-info-section">
      <div class="detail-title-row">
        <h3 class="detail-book-title">${escapeHtml(book.name)}</h3>
        ${statusHtml}
      </div>
      ${authorsText ? `<div class="detail-authors">${authorsText}</div>` : ''}
      <div class="detail-meta-row">
        <span class="detail-meta-chip">${formatLabel}</span>
        ${seriesHtml}
      </div>
      ${progressHtml}
      ${tagsHtml}
      ${datesHtml}
      ${notesHtml}
      <div class="detail-sessions" id="detail-sessions">
        <div class="loading">Loading sessions...</div>
      </div>
    </div>
  `;

  // Clickable status badge → navigate to library filtered by this status
  const badge = body.querySelector('.detail-status-link');
  if (badge) {
    badge.addEventListener('click', () => {
      callbacks.navigateToLibraryWithFilter({ status: badge.dataset.status });
    });
  }

  // Clickable author links
  body.querySelectorAll('.detail-author-link').forEach((el) => {
    el.addEventListener('click', () => {
      callbacks.navigateToLibraryWithFilter({ author: el.dataset.author });
    });
  });

  // Clickable genre/topic tags
  body.querySelectorAll('.detail-tag-link').forEach((el) => {
    if (el.dataset.genre) {
      el.addEventListener('click', () =>
        callbacks.navigateToLibraryWithFilter({ genre: el.dataset.genre })
      );
    } else if (el.dataset.topic) {
      el.addEventListener('click', () =>
        callbacks.navigateToLibraryWithFilter({ topic: el.dataset.topic })
      );
    }
  });

  // Clickable series chip
  const seriesLink = body.querySelector('.detail-series-link');
  if (seriesLink) {
    seriesLink.addEventListener('click', () => {
      const seriesId = parseInt(seriesLink.dataset.seriesId);
      const seriesName = seriesLink.dataset.series;
      callbacks.navigateToLibraryWithFilter({ series: { id: seriesId, name: seriesName } });
    });
  }

  // Notes edit/save/cancel
  const editBtn = body.querySelector('.detail-notes-edit-btn');
  const editor = body.querySelector('#detail-notes-editor');
  const display = body.querySelector('#detail-notes-display');
  const textarea = body.querySelector('#detail-notes-textarea');
  const cancelBtn = body.querySelector('.detail-notes-cancel');
  const saveBtn = body.querySelector('.detail-notes-save');

  if (textarea) {
    textarea.value = book.thoughts || '';
  }

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      editor.classList.remove('hidden');
      display.classList.add('hidden');
      editBtn.classList.add('hidden');
      textarea.focus();
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      editor.classList.add('hidden');
      display.classList.remove('hidden');
      editBtn.classList.remove('hidden');
      textarea.value = book.thoughts || '';
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const notes = textarea.value.trim();
      const result = await BookManager.updateBook({ id: bookId, thoughts: notes || null });
      if (result.success) {
        showToast(t('toast.notesSaved'), 'success');
        openDetailModal(bookId, callbacks);
      } else {
        showToast(t('toast.notesFailed'), 'error');
      }
    });
  }

  modal.classList.remove('hidden');

  // Load reading sessions
  loadDetailSessions(bookId);
}

async function loadDetailSessions(bookId) {
  const container = document.getElementById('detail-sessions');
  const book = BookManager.getBook(bookId);
  const format = book?.format || 'paper';
  try {
    const result = await API.getReadingSessions(bookId);
    if (result.success && result.sessions.length > 0) {
      container.innerHTML = `
        <span class="detail-label">${t('book.readingSessions')}</span>
        <div class="session-list">
          ${result.sessions
            .map((s) => {
              let metricHtml;
              if (format === 'audiobook') {
                metricHtml = s.duration_minutes
                  ? `<span class="session-pages">🎧 ${formatDuration(s.duration_minutes)}</span>`
                  : '';
              } else {
                metricHtml = `<span class="session-pages">p. ${s.pages_read}</span>`;
                if (s.duration_minutes)
                  metricHtml += ` <span class="session-duration">${s.duration_minutes}min</span>`;
              }
              return `
            <div class="session-item">
              <span class="session-date">${formatDateRelative(s.session_date)}</span>
              ${metricHtml}
              ${s.notes ? `<span class="session-notes">${escapeHtml(s.notes)}</span>` : ''}
            </div>
          `;
            })
            .join('')}
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  } catch {
    container.innerHTML = '';
  }
}

/**
 * Close the detail modal
 */
export function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.classList.add('modal-closing');
  modal.addEventListener(
    'animationend',
    () => {
      modal.classList.add('hidden');
      modal.classList.remove('modal-closing');
    },
    { once: true }
  );
}

/**
 * Navigate to library with a specific filter applied
 * @param {Object} filters
 * @param {Object} callbacks
 * @param {Function} callbacks.switchView
 * @param {Function} callbacks.renderActiveFilterPills
 */
export function navigateToLibraryWithFilter(
  { author, status, genre, topic, search, series } = {},
  callbacks
) {
  // Reset all filters first
  BookManager.setSearch('');
  BookManager.setFilter([]);
  BookManager.setGenreFilter('');
  BookManager.setTopicFilter('');
  BookManager.setAuthorFilter('');
  BookManager.setSeriesFilter(null);
  BookManager.setAudiobookFilter('all');
  BookManager.setSort('newest');

  // Reset UI controls
  document.getElementById('search-input').value = '';
  document.getElementById('genre-filter').value = '';
  document.getElementById('topic-filter').value = '';
  document.getElementById('audiobook-filter').value = 'all';
  document.getElementById('sort-select').value = 'newest';
  document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelector('.filter-tab[data-status="all"]')?.classList.add('active');

  // Apply the requested filter
  if (author) {
    BookManager.setAuthorFilter(author);
  }
  if (status) {
    BookManager.setFilter([status]);
    document.querySelector('.filter-tab[data-status="all"]')?.classList.remove('active');
    document.querySelector(`.filter-tab[data-status="${status}"]`)?.classList.add('active');
  }
  if (genre) {
    BookManager.setGenreFilter(genre);
    document.getElementById('genre-filter').value = genre;
  }
  if (topic) {
    BookManager.setTopicFilter(topic);
    document.getElementById('topic-filter').value = topic;
  }
  if (search) {
    BookManager.setSearch(search);
    document.getElementById('search-input').value = search;
  }
  if (series) {
    BookManager.setSeriesFilter(series.id);
    BookManager._seriesFilterName = series.name;
  }

  // Close detail modal and navigate to library
  closeDetailModal();
  callbacks.switchView('library');
  callbacks.renderActiveFilterPills();
}
