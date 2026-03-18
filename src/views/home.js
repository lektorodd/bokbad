import API from '../api.js';
import BookManager from '../bookManager.js';
import { t } from '../i18n.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, escapeAttribute, sanitizeImageUrl } from '../utils/escapeHtml.js';


/**
 * Get localized genre label
 * @param {string} key
 * @returns {string}
 */
export function getGenreLabel(key) {
  const label = t(`genres.${key}`);
  return label && label !== `genres.${key}` ? label : key;
}

let currentCarouselIndex = 0;

/**
 * Render the home view
 * @param {Object} callbacks
 * @param {Function} callbacks.openDetailModal
 * @param {Function} callbacks.openSessionModal
 * @param {Function} callbacks.renderBooks
 * @param {Function} callbacks.updateFilterTabCounts
 * @param {Function} callbacks.openActivityCalendar
 */
export function renderHome(callbacks) {
  renderStreakTracker(callbacks);
  loadGoalWidget(callbacks);

  const readingBooks = BookManager.getBooksByStatus('reading');
  // Sort by progress descending — most-read first
  readingBooks.sort(
    (a, b) => BookManager.getProgressPercent(b) - BookManager.getProgressPercent(a)
  );
  const upNextBooks = BookManager.getBooksByStatus('up-next');

  const container = document.getElementById('reading-now-container');
  const dotsEl = document.getElementById('carousel-dots');

  // --- Reading Now Carousel ---
  if (readingBooks.length === 0) {
    container.innerHTML = `<div class="carousel-slide">
      <div class="empty-state-inline" style="padding: var(--spacing-xl); border-style: dashed;">
        <span class="empty-state-inline-icon" style="font-size: 2.5rem;">📚</span>
        <p style="margin-bottom: var(--spacing-sm);">${t('home.emptyReading')}</p>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('add-book-btn').click()" style="margin-top: var(--spacing-sm);">${t('library.addBook')}</button>
      </div>
    </div>`;
    dotsEl.innerHTML = '';
  } else {
    container.innerHTML = readingBooks
      .map((book, i) => {
        const card = createHomeCard(book, true, true);
        return `<div class="carousel-slide" data-index="${i}">${card}</div>`;
      })
      .join('');

    // Dots
    if (readingBooks.length > 1) {
      dotsEl.innerHTML = readingBooks
        .map(
          (_, i) =>
            `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}"></button>`
        )
        .join('');
      dotsEl.querySelectorAll('.carousel-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
          scrollToSlide(parseInt(dot.dataset.index));
        });
      });
    } else {
      dotsEl.innerHTML = '';
    }

    // Scroll-snap observer to update dots
    const viewport = document.getElementById('reading-now-carousel');
    viewport.addEventListener('scroll', () => {
      const slideWidth = viewport.offsetWidth;
      const idx = Math.round(viewport.scrollLeft / slideWidth);
      if (idx !== currentCarouselIndex) {
        currentCarouselIndex = idx;
        updateCarouselDots(idx);
      }
    });
  }

  // --- Up Next (thumbnails) ---
  const upNextContainer = document.getElementById('up-next-container');
  if (upNextBooks.length === 0) {
    upNextContainer.innerHTML =
      '<div class="empty-state-inline"><span class="empty-state-inline-icon">⏭️</span>No books queued up yet</div>';
  } else {
    upNextContainer.innerHTML = upNextBooks
      .map((book) => {
        const safeCover = sanitizeImageUrl(book.cover_image);
        const cover = safeCover
          ? `<img class="up-next-thumb-img" src="${escapeAttribute(safeCover)}" alt="" />`
          : `<div class="up-next-thumb-placeholder">📖</div>`;
        const title = escapeHtml(book.name);
        return `<div class="up-next-thumb" data-book-id="${book.id}">${cover}<div class="up-next-thumb-title">${title}</div></div>`;
      })
      .join('');
    upNextContainer.querySelectorAll('.up-next-thumb').forEach((el) => {
      el.addEventListener('click', () => callbacks.openDetailModal(parseInt(el.dataset.bookId)));
    });
  }

  // Add click listeners for carousel cards
  document.querySelectorAll('.home-card').forEach((card) => {
    card.addEventListener('click', () => {
      const bookId = parseInt(card.dataset.bookId);
      callbacks.openDetailModal(bookId);
    });
  });

  // --- Log Reading pill: Show if there are non-read books ---
  const logBtn = document.getElementById('home-log-reading-btn');
  const allNonRead = BookManager.books.filter((b) => b.status !== 'read');
  if (allNonRead.length > 0) {
    logBtn.classList.remove('hidden');
  } else {
    logBtn.classList.add('hidden');
  }
}

function scrollToSlide(index) {
  const viewport = document.getElementById('reading-now-carousel');
  const slideWidth = viewport.offsetWidth;
  viewport.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
  currentCarouselIndex = index;
  updateCarouselDots(index);
}

function updateCarouselDots(activeIndex) {
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === activeIndex);
  });
}

/**
 * Show book picker for log reading
 * @param {Array} readingBooks
 * @param {Array} otherBooks
 * @param {Object} callbacks
 */
export function showBookPicker(readingBooks, otherBooks, callbacks) {
  // Remove existing picker
  const existing = document.querySelector('.book-picker-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  const wrapper = document.getElementById('home-view');
  const dropdown = document.createElement('div');
  dropdown.className = 'book-picker-dropdown';
  dropdown.style.position = 'fixed';
  dropdown.style.bottom = '140px';
  dropdown.style.right = '16px';
  dropdown.style.zIndex = '200';

  const renderItem = (book, isOther = false) => {
    const safeCover = sanitizeImageUrl(book.cover_image);
    const coverHtml = safeCover
      ? `<img src="${escapeAttribute(safeCover)}" alt="" class="book-picker-thumb" />`
      : '<div class="book-picker-thumb-placeholder">📖</div>';

    return `
      <button class="book-picker-item${isOther ? ' book-picker-other' : ''}" data-book-id="${book.id}" data-needs-promote="${isOther}">
        ${coverHtml}
        <span class="book-picker-name">${escapeHtml(book.name)}</span>
      </button>
    `;
  };

  let html = '';
  if (readingBooks.length > 0) {
    html += readingBooks.map((b) => renderItem(b, false)).join('');
  }
  if (otherBooks.length > 0) {
    if (readingBooks.length > 0) {
      html += '<div class="book-picker-divider">' + t('home.otherBooks') + '</div>';
    }
    html += otherBooks.map((b) => renderItem(b, true)).join('');
  }

  dropdown.innerHTML = html;
  wrapper.appendChild(dropdown);

  dropdown.querySelectorAll('.book-picker-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const bookId = parseInt(item.dataset.bookId);
      const needsPromote = item.dataset.needsPromote === 'true';
      dropdown.remove();

      if (needsPromote) {
        // Auto-promote to "reading"
        const result = await BookManager.updateBook({ id: bookId, status: 'reading' });
        if (result.success) {
          showToast(t('toast.bookMovedReading'), 'success');
          callbacks.renderHome();
          callbacks.renderBooks();
          callbacks.updateFilterTabCounts();
        }
      }
      callbacks.openSessionModal(bookId);
    });
  });

  // Close on outside click
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 10);
}

// Streak tracker
async function renderStreakTracker(callbacks) {
  const container = document.getElementById('streak-tracker');
  if (!container) return;

  try {
    const result = await API.getStreakData(10);
    if (!result.success) {
      container.innerHTML = '';
      return;
    }

    const { days, streak } = result;
    const showFlame = streak >= 3;

    let dotsHtml = days
      .map((day, i) => {
        const isToday = i === days.length - 1;
        const classes = ['streak-dot'];
        if (day.read) classes.push('active');
        if (isToday) classes.push('today');
        // Show weekday initial
        const date = new Date(day.date + 'T12:00:00');
        const dayLabel = date.toLocaleDateString('en', { weekday: 'narrow' });
        return `<div class="${classes.join(' ')}" title="${day.date}"><span class="streak-day-label">${dayLabel}</span></div>`;
      })
      .join('');

    const flameHtml = showFlame ? '<span class="streak-flame">🔥</span>' : '';
    const streakText =
      streak > 0
        ? `<span class="streak-count">${t('home.dayStreak', { count: streak })} ${flameHtml}</span>`
        : '<span class="streak-count streak-count-zero">' + t('home.startStreak') + '</span>';

    container.innerHTML = `
      <div class="streak-dots" style="cursor:pointer" id="streak-dots-tap">${dotsHtml}</div>
      ${streakText}
    `;
    // Make tappable to open calendar
    container
      .querySelector('#streak-dots-tap')
      ?.addEventListener('click', () => callbacks.openActivityCalendar());
  } catch (error) {
    console.error('Failed to load streak data:', error);
    container.innerHTML = '';
  }
}

/**
 * Load and render the reading goal widget
 * @param {Object} callbacks
 * @param {Function} callbacks.openSettings
 */
export async function loadGoalWidget(_callbacks) {
  try {
    const year = new Date().getFullYear();
    const result = await API.getGoal(year);
    if (!result.success) return;

    const goalEl = document.getElementById('goal-widget');
    const countEl = document.getElementById('goal-count');
    const targetEl = document.getElementById('goal-target');
    const labelEl = document.getElementById('goal-label');
    const progressEl = document.getElementById('goal-ring-progress');
    const barFillEl = document.getElementById('goal-bar-fill');

    const booksRead = result.progress?.booksRead || 0;
    const targetBooks = result.goal?.targetBooks;

    // Store for tap-to-show
    goalEl._booksReadList = result.progress?.booksReadList || [];

    const circumference = 97.4; // 2 × π × 15.5
    countEl.textContent = booksRead;

    if (targetBooks) {
      targetEl.textContent = t('home.booksOf', { read: booksRead, target: targetBooks });
      const pct = Math.min(booksRead / targetBooks, 1);
      progressEl.style.strokeDashoffset = circumference * (1 - pct);
      if (barFillEl) barFillEl.style.width = `${Math.round(pct * 100)}%`;
      labelEl.textContent = pct >= 1 ? t('home.goalReached') : t('home.readingGoal', { year });
    } else {
      targetEl.textContent = t('home.goalTap');
      progressEl.style.strokeDashoffset = circumference;
      if (barFillEl) barFillEl.style.width = '0%';
      labelEl.textContent = t('home.goalSet');
    }
    goalEl.classList.remove('hidden');
  } catch (e) {
    console.error('Failed to load goal:', e);
  }
}

/**
 * Show list of books read this year as a toast
 */
export function showBooksReadList() {
  const goalEl = document.getElementById('goal-widget');
  const books = goalEl._booksReadList || [];
  if (books.length === 0) {
    showToast('No books finished this year yet');
    return;
  }
  const list = books
    .map(
      (b) =>
        `<div style="padding:2px 0">📖 ${escapeHtml(b.name)} <small style="opacity:.6">${escapeHtml(b.finish_date || '')}</small></div>`
    )
    .join('');
  showToast(`<strong>Books read in ${new Date().getFullYear()}:</strong>${list}`, 'info', 6000, {
    allowHtml: true,
  });
}

function createHomeCard(book, isReading, isFeatured = false) {
  const safeCover = sanitizeImageUrl(book.cover_image);
  const coverImg = safeCover
    ? `<img src="${escapeAttribute(safeCover)}" alt="${escapeHtml(book.name)}" class="home-card-cover" />`
    : `<div class="home-card-cover-placeholder">📖</div>`;

  const authorsHtml =
    book.authors && book.authors.length > 0
      ? `<div class="home-card-authors">${escapeHtml(book.authors.join(', '))}</div>`
      : '';

  // Format overlay badge on cover (emoji only, floating circle)
  let formatOverlay = '';
  if (book.format === 'audiobook') {
    formatOverlay = '<span class="cover-format-badge">🎧</span>';
  } else if (book.format === 'ebook') {
    formatOverlay = '<span class="cover-format-badge">📱</span>';
  }

  // Wrap cover + badge in relative container
  const coverHtml = `<div class="home-card-cover-wrap">${coverImg}${formatOverlay}</div>`;

  // Circular progress ring for reading books
  let progressRingHtml = '';
  if (isReading) {
    const pct = BookManager.getProgressPercent(book);
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    progressRingHtml = `
      <div class="progress-ring-wrapper">
        <svg class="progress-ring" width="56" height="56" viewBox="0 0 56 56">
          <circle class="progress-ring-bg" cx="28" cy="28" r="${radius}" fill="none" stroke-width="4" />
          <circle class="progress-ring-fill" cx="28" cy="28" r="${radius}" fill="none" stroke-width="4"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 28 28)" />
          <text x="28" y="29" text-anchor="middle" dominant-baseline="middle" class="progress-ring-text">${pct}%</text>
        </svg>
      </div>
    `;
  }

  const cardClass = isFeatured
    ? 'home-card home-card-reading home-card-featured'
    : `home-card ${isReading ? 'home-card-reading' : 'home-card-upnext'}`;

  return `
    <div class="${cardClass}" data-book-id="${book.id}">
      ${coverHtml}
      <div class="home-card-info">
        ${progressRingHtml}
        <div class="home-card-text">
          <div class="home-card-title">${escapeHtml(book.name)}</div>
          ${authorsHtml}
        </div>
      </div>
    </div>
  `;
}
