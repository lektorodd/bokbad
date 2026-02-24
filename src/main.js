import './style.css';
import Auth from './auth.js';
import BookManager from './bookManager.js';
import API from './api.js';
import { Chart, registerables } from 'chart.js';
import { Html5Qrcode } from 'html5-qrcode';
import { t, getLocale, setLocale, initI18n } from './i18n.js';

// Register Chart.js components
Chart.register(...registerables);

// Global state
let currentChart = null;
let genreChart = null;
let dailyChart = null;
let currentUploadedCoverUrl = null;
let currentGenres = [];
let currentTopics = [];
let currentAuthors = [];

// Predefined genre keys — labels come from i18n (genres.xxx)
const GENRE_HIERARCHY = {
  fiction: [
    'novel', 'thriller', 'mystery', 'scifi', 'fantasy', 'romance',
    'horror', 'drama', 'classic', 'poetry', 'humor', 'ya', 'children', 'graphic'
  ],
  nonfiction: [
    'biography', 'memoir', 'history', 'science', 'selfhelp', 'business',
    'philosophy', 'health', 'politics', 'religion', 'travel', 'cooking', 'art', 'essays'
  ]
};

const FICTION_GENRES = new Set(GENRE_HIERARCHY.fiction);
const NONFICTION_GENRES = new Set(GENRE_HIERARCHY.nonfiction);
const PREDEFINED_GENRES = [...GENRE_HIERARCHY.fiction, ...GENRE_HIERARCHY.nonfiction];

function getGenreLabel(key) {
  const label = t(`genres.${key}`);
  // If the key doesn't exist in translations, return the raw key capitalised
  return (label && label !== `genres.${key}`) ? label : key;
}

// Map a legacy free-text genre to a predefined key (case-insensitive)
function normalizeGenreKey(rawGenre) {
  const lower = rawGenre.trim().toLowerCase();
  if (PREDEFINED_GENRES.includes(lower)) return lower;
  // Try matching against English labels
  const enLabels = {
    'fiction': 'fiction', 'non-fiction': 'nonfiction', 'nonfiction': 'nonfiction',
    'biography': 'biography', 'novel': 'novel', 'thriller': 'thriller',
    'mystery': 'mystery', 'sci-fi': 'scifi', 'scifi': 'scifi',
    'fantasy': 'fantasy', 'history': 'history', 'science': 'science',
    'self-help': 'selfhelp', 'selfhelp': 'selfhelp', 'business': 'business',
    'philosophy': 'philosophy', 'poetry': 'poetry', "children's": 'children',
    'children': 'children', 'young adult': 'ya', 'ya': 'ya',
    'humor': 'humor', 'humour': 'humor', 'travel': 'travel',
    'cooking': 'cooking', 'art': 'art', 'health': 'health',
    'religion': 'religion', 'politics': 'politics', 'memoir': 'memoir',
    'romance': 'romance', 'horror': 'horror', 'graphic novel': 'graphic',
    'graphic': 'graphic', 'essays': 'essays', 'classic': 'classic',
    'drama': 'drama'
  };
  if (enLabels[lower]) return enLabels[lower];
  // Try matching against Norwegian labels
  const noLabels = {
    'skjønnlitteratur': 'fiction', 'sakprosa': 'nonfiction', 'biografi': 'biography',
    'roman': 'novel', 'krim': 'mystery', 'historie': 'history',
    'vitenskap': 'science', 'selvhjelp': 'selfhelp', 'næringsliv': 'business',
    'filosofi': 'philosophy', 'poesi': 'poetry', 'barnebøker': 'children',
    'ungdom': 'ya', 'reise': 'travel', 'mat og drikke': 'cooking',
    'kunst': 'art', 'helse': 'health', 'politikk': 'politics',
    'memoar': 'memoir', 'romantikk': 'romance', 'skrekk': 'horror',
    'tegneserie': 'graphic', 'essay': 'essays', 'klassiker': 'classic'
  };
  if (noLabels[lower]) return noLabels[lower];
  return lower; // fallback: keep as-is
}

function normalizeGenres(genres) {
  if (!genres || !Array.isArray(genres)) return [];
  const normalized = genres.map(g => normalizeGenreKey(g))
    .filter(g => g !== 'fiction' && g !== 'nonfiction'); // Strip legacy parent genres
  return [...new Set(normalized)]; // deduplicate
}

function renderGenreSelectGrid(selectedGenres = []) {
  const container = document.getElementById('genre-select-grid');
  if (!container) return;

  let html = '';
  // Fiction section
  html += `<div class="genre-group-label">${escapeHtml(getGenreLabel('fiction'))}</div>`;
  html += `<div class="genre-group">`;
  html += GENRE_HIERARCHY.fiction.map(key => {
    const selected = selectedGenres.includes(key) ? ' selected' : '';
    return `<button type="button" class="genre-chip-option${selected}" data-genre="${key}">${escapeHtml(getGenreLabel(key))}</button>`;
  }).join('');
  html += `</div>`;

  // Non-fiction section
  html += `<div class="genre-group-label">${escapeHtml(getGenreLabel('nonfiction'))}</div>`;
  html += `<div class="genre-group">`;
  html += GENRE_HIERARCHY.nonfiction.map(key => {
    const selected = selectedGenres.includes(key) ? ' selected' : '';
    return `<button type="button" class="genre-chip-option${selected}" data-genre="${key}">${escapeHtml(getGenreLabel(key))}</button>`;
  }).join('');
  html += `</div>`;

  container.innerHTML = html;
  container.querySelectorAll('.genre-chip-option').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      currentGenres = Array.from(container.querySelectorAll('.genre-chip-option.selected'))
        .map(el => el.dataset.genre);
    });
  });
}

// ============ Dark Mode ============
function initDarkMode() {
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

function applyDarkMode(isDark) {
  document.documentElement.classList.toggle('dark-mode', isDark);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    const icon = btn.querySelector('.dropdown-icon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    const label = btn.querySelector('[data-i18n]');
    if (label) {
      label.setAttribute('data-i18n', isDark ? 'menu.lightMode' : 'menu.darkMode');
      label.textContent = t(isDark ? 'menu.lightMode' : 'menu.darkMode');
    }
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark-mode');
  localStorage.setItem('bokbad-dark-mode', isDark);
  const btn = document.getElementById('dark-mode-toggle');
  if (btn) {
    const icon = btn.querySelector('.dropdown-icon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    const label = btn.querySelector('[data-i18n]');
    if (label) {
      label.setAttribute('data-i18n', isDark ? 'menu.lightMode' : 'menu.darkMode');
      label.textContent = t(isDark ? 'menu.lightMode' : 'menu.darkMode');
    }
  }
}

// ============ Date Formatting ============
function formatDate(dateStr, precision = 'day') {
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
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  } catch {
    return dateStr;
  }
}

function formatDateRelative(dateStr) {
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

// Initialize app
async function init() {
  initDarkMode();
  await initI18n();

  // Wire language selector
  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = getLocale();
    langSelect.addEventListener('change', async (e) => {
      await setLocale(e.target.value);
      // Re-render active view
      const activeView = document.querySelector('.view.active');
      if (activeView?.id === 'home-view') renderHome();
      else if (activeView?.id === 'library-view') { updateFilterTabCounts(); renderBooks(); }
      else if (activeView?.id === 'dashboard-view') loadDashboard();
    });
  }

  // Listen for session expiration (401 from any API call)
  window.addEventListener('session-expired', () => {
    showToast(t('toast.sessionExpired'), 'error');
    showLogin();
    setupLoginListeners();
  }, { once: true });

  const isAuthenticated = await Auth.checkAuthentication();

  if (isAuthenticated) {
    showApp();
    loadViewPreference();
    // Wire up event listeners FIRST so the UI is always interactive,
    // even if data loading fails.
    setupEventListeners();
    try {
      await loadBooks();
      await BookManager.loadTags();
      await loadSeriesList();
      populateFilterDropdowns();
      restoreTimer();
    } catch (err) {
      console.error('Init data loading failed:', err);
      showToast(t('toast.dataLoadFailed'), 'error');
    }
    // Force password change if flagged
    if (Auth.currentUser?.must_change_password) {
      openSettings();
      showToast(t('toast.mustChangePassword'), 'warning');
    }
  } else {
    showLogin();
    setupLoginListeners();
  }
}

// Show/hide views
function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // Show/hide admin panel link based on role
  const adminLink = document.getElementById('admin-panel-link');
  if (adminLink) {
    adminLink.classList.toggle('hidden', !Auth.isAdmin());
  }
}

function switchView(viewName) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  // Update views
  document.querySelectorAll('.app-main > .view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.add('active');

    if (viewName === 'home') {
      renderHome();
    } else if (viewName === 'library') {
      renderBooks();
    } else if (viewName === 'dashboard') {
      loadDashboard();
    }
  }

  // Show FAB only on home view
  const fab = document.getElementById('add-book-btn');
  if (fab) {
    fab.classList.toggle('fab-hidden', viewName !== 'home');
  }
}

// ============ Toast Notification System ============
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// ============ Format Fields ============
function updateFormatFields(format) {
  const durationGroup = document.getElementById('total-duration-group');
  const currentPageGroup = document.getElementById('current-page-group');
  const currentDurationGroup = document.getElementById('current-duration-group');
  const currentPercentageGroup = document.getElementById('current-percentage-group');
  const totalPagesGroup = document.getElementById('total-pages-group');

  // Hide all optional groups first
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

// Swap finish date input based on precision selection
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
    // Try to extract year from existing value
    if (currentValue) {
      newInput.value = currentValue.substring(0, 4);
    }
  } else if (precision === 'month') {
    newInput = document.createElement('input');
    newInput.type = 'month';
    newInput.id = 'book-finish-date';
    // Try to extract YYYY-MM from existing value
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

function formatDuration(totalMinutes) {
  if (!totalMinutes) return `0${t('time.h')} 0${t('time.m')}`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}${t('time.h')} ${m}${t('time.m')}` : `${m}${t('time.m')}`;
}



function setupLoginListeners() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me')?.checked ?? true;
    const errorEl = document.getElementById('login-error');

    const result = await Auth.login(username, password, rememberMe);

    if (result.success) {
      showApp();
      // Wire up event listeners FIRST so the UI is always interactive
      setupEventListeners();
      try {
        await loadBooks();
        await BookManager.loadTags();
        await loadSeriesList();
        populateFilterDropdowns();
      } catch (err) {
        console.error('Post-login data loading failed:', err);
        showToast(t('toast.dataLoadFailed'), 'error');
      }
      // Force password change if flagged
      if (Auth.currentUser?.must_change_password) {
        openSettings();
        showToast(t('toast.mustChangePassword'), 'warning');
      }
    } else {
      errorEl.textContent = result.error;
    }
  });
}

// ============ Pull to Refresh ============
function setupPullToRefresh() {
  const main = document.querySelector('.app-main');
  if (!main) return;

  const PULL_THRESHOLD = 120; // px – must pull significantly to trigger
  let startY = 0;
  let startX = 0;
  let pulling = false;
  let atTop = false;
  let pullIndicator = null;
  let cancelled = false;

  function getOrCreateIndicator() {
    if (!pullIndicator) {
      pullIndicator = document.createElement('div');
      pullIndicator.className = 'pull-indicator';
      pullIndicator.innerHTML = '<span class="pull-spinner">↻</span><span class="pull-text">' + t('pull.pullToRefresh') + '</span>';
      main.prepend(pullIndicator);
    }
    return pullIndicator;
  }

  main.addEventListener('touchstart', (e) => {
    // Only allow pull if already resting at top (not scrolling up to top)
    atTop = main.scrollTop <= 0;
    cancelled = false;
    if (atTop) {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      pulling = false;
    }
  }, { passive: true });

  main.addEventListener('touchmove', (e) => {
    if (!atTop || cancelled) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;

    // Cancel pull if horizontal movement dominates (e.g. carousel, filter scroll)
    if (!pulling && Math.abs(dx) > 30) {
      cancelled = true;
      pulling = false;
      if (pullIndicator) {
        pullIndicator.style.height = '0px';
        pullIndicator.style.opacity = '0';
      }
      return;
    }

    // Only engage pull once the user has moved >= 10px downward (intent guard)
    if (!pulling && dy > 10 && main.scrollTop <= 0) {
      pulling = true;
    }

    if (!pulling) return;
    if (dy > 0 && main.scrollTop <= 0) {
      const indicator = getOrCreateIndicator();
      const progress = Math.min(dy / PULL_THRESHOLD, 1);
      indicator.style.height = `${Math.min(dy * 0.4, 70)}px`;
      indicator.style.opacity = progress;
      indicator.querySelector('.pull-spinner').style.transform = `rotate(${dy * 2}deg)`;
      if (dy > PULL_THRESHOLD) {
        indicator.querySelector('.pull-text').textContent = t('pull.releaseToRefresh');
        indicator.classList.add('pull-ready');
      } else {
        indicator.querySelector('.pull-text').textContent = t('pull.pullToRefresh');
        indicator.classList.remove('pull-ready');
      }
    } else {
      // User scrolled back up – cancel
      pulling = false;
    }
  }, { passive: true });

  main.addEventListener('touchend', async () => {
    if (!pulling || cancelled) {
      atTop = false;
      pulling = false;
      cancelled = false;
      if (pullIndicator) {
        pullIndicator.style.height = '0px';
        pullIndicator.style.opacity = '0';
        setTimeout(() => { pullIndicator?.remove(); pullIndicator = null; }, 200);
      }
      return;
    }
    pulling = false;
    atTop = false;
    const indicator = pullIndicator;
    if (indicator && indicator.classList.contains('pull-ready')) {
      indicator.querySelector('.pull-text').textContent = t('pull.refreshing');
      indicator.querySelector('.pull-spinner').classList.add('spinning');
      try {
        await BookManager.loadBooks();
        await BookManager.loadTags();
        const activeView = document.querySelector('.view.active');
        if (activeView?.id === 'home-view') renderHome();
        else if (activeView?.id === 'library-view') renderBooks();
        else if (activeView?.id === 'dashboard-view') loadDashboard();
        if (indicator) {
          indicator.querySelector('.pull-text').textContent = t('pull.updated');
          indicator.querySelector('.pull-spinner').classList.remove('spinning');
        }
      } catch (err) {
        if (indicator) {
          indicator.querySelector('.pull-text').textContent = t('pull.refreshFailed');
        }
      }
    }
    if (indicator) {
      setTimeout(() => {
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
        setTimeout(() => { indicator.remove(); pullIndicator = null; }, 300);
      }, 600);
    }
  });
}

// ============ Swipe Gestures ============
let isProcessingSwipe = false;

function attachSwipeHandlers(container) {
  let startX = 0;
  let startY = 0;
  let currentCard = null;
  let swiping = false;
  const THRESHOLD = 70;

  container.addEventListener('touchstart', (e) => {
    if (isProcessingSwipe) return;
    // Skip swipe in grid view — only taps
    if (container.classList.contains('grid-view')) return;
    const card = e.target.closest('.book-card');
    if (!card) return;

    // Reset any previously swiped cards
    container.querySelectorAll('.book-card.swiped-left, .book-card.swiped-right').forEach(c => {
      if (c !== card) resetSwipe(c);
    });

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentCard = card;
    swiping = false;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!currentCard || isProcessingSwipe) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // If vertical scroll dominates, cancel swipe
    if (!swiping && Math.abs(dy) > Math.abs(dx)) {
      currentCard = null;
      return;
    }

    if (Math.abs(dx) > 10) swiping = true;

    if (swiping) {
      e.preventDefault();
      const cardInner = currentCard.querySelector('.book-card-inner') || currentCard;
      const clampedDx = Math.max(-120, Math.min(120, dx));
      cardInner.style.transform = `translateX(${clampedDx}px)`;
      cardInner.style.transition = 'none';

      // Show/hide action backgrounds
      let leftAction = currentCard.querySelector('.swipe-action-left');
      let rightAction = currentCard.querySelector('.swipe-action-right');
      if (dx < 0 && leftAction) {
        leftAction.style.opacity = Math.min(1, Math.abs(dx) / THRESHOLD);
      }
      if (dx > 0 && rightAction) {
        rightAction.style.opacity = Math.min(1, dx / THRESHOLD);
      }
    }
  }, { passive: false });

  container.addEventListener('touchend', async () => {
    if (!currentCard || !swiping || isProcessingSwipe) {
      currentCard = null;
      return;
    }

    const cardInner = currentCard.querySelector('.book-card-inner') || currentCard;
    const transform = cardInner.style.transform;
    const match = transform.match(/translateX\((-?[\d.]+)px\)/);
    const dx = match ? parseFloat(match[1]) : 0;
    const bookId = parseInt(currentCard.dataset.bookId);

    // Reset visual immediately
    resetSwipe(currentCard);
    currentCard = null;
    swiping = false;

    if (dx < -THRESHOLD) {
      // Swiped left → change status
      isProcessingSwipe = true;
      const book = BookManager.getBook(bookId);
      if (book) {
        const statusFlow = ['want-to-read', 'up-next', 'reading', 'read'];
        const currentIndex = statusFlow.indexOf(book.status);
        const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];
        const nextLabel = { 'want-to-read': t('status.wantToRead'), 'up-next': t('status.upNext'), 'reading': t('status.reading'), 'read': t('status.read') }[nextStatus];
        await BookManager.updateBook({ id: bookId, status: nextStatus });
        showToast(t('toast.statusChanged', { status: nextLabel }), 'success');
        renderBooks();
        renderHome();
        updateFilterTabCounts();
      }
      isProcessingSwipe = false;
    } else if (dx > THRESHOLD) {
      // Swiped right → log reading
      openSessionModal(bookId);
    }
  });
}

function resetSwipe(card) {
  const cardInner = card.querySelector('.book-card-inner') || card;
  cardInner.style.transition = 'transform 0.25s ease';
  cardInner.style.transform = 'translateX(0)';
  const leftAction = card.querySelector('.swipe-action-left');
  const rightAction = card.querySelector('.swipe-action-right');
  if (leftAction) leftAction.style.opacity = '0';
  if (rightAction) rightAction.style.opacity = '0';
}

// ============ Event Listeners ============
function setupEventListeners() {
  // Dark mode toggle
  document.getElementById('dark-mode-toggle')?.addEventListener('click', toggleDarkMode);
  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await Auth.logout();
    showLogin();
    setupLoginListeners();
  });

  // Bottom navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
    });
  });

  // Add book button
  document.getElementById('add-book-btn').addEventListener('click', () => {
    openBookModal();
  });

  // Pull-to-refresh
  setupPullToRefresh();

  // Edit modal close
  document.getElementById('modal-close').addEventListener('click', closeBookModal);
  document.getElementById('cancel-book-btn').addEventListener('click', closeBookModal);

  // Click outside edit modal to close
  document.getElementById('book-modal').addEventListener('click', (e) => {
    if (e.target.id === 'book-modal') {
      closeBookModal();
    }
  });

  // Detail modal
  document.getElementById('detail-close-btn').addEventListener('click', closeDetailModal);

  // Calendar modal
  document.getElementById('calendar-close-btn').addEventListener('click', () => {
    const modal = document.getElementById('calendar-modal');
    modal.classList.add('modal-closing');
    modal.addEventListener('animationend', () => {
      modal.classList.add('hidden');
      modal.classList.remove('modal-closing');
    }, { once: true });
  });

  // Streak stat in dashboard → open calendar
  document.getElementById('stat-streak')?.closest('.stat-metric')?.addEventListener('click', () => openActivityCalendar());

  // Detail modal: Log Reading
  document.getElementById('detail-log-btn').addEventListener('click', () => {
    const bookId = document.getElementById('detail-modal').dataset.bookId;
    if (bookId) {
      closeDetailModal();
      openSessionModal(parseInt(bookId));
    }
  });

  // Detail modal: Edit
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    const bookId = document.getElementById('detail-modal').dataset.bookId;
    if (bookId) {
      closeDetailModal();
      openBookModal(parseInt(bookId));
    }
  });
  document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
      closeDetailModal();
    }
  });

  // Book form submit
  document.getElementById('book-form').addEventListener('submit', handleBookSubmit);

  // Delete book
  document.getElementById('delete-book-btn').addEventListener('click', handleBookDelete);

  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', debounce((e) => {
    BookManager.setSearch(e.target.value);
    renderBooks();
    renderActiveFilterPills();
  }, 300));

  // Filter tabs (multi-select)
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const status = tab.dataset.status;
      if (status === 'all') {
        // "All" deselects everything
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        BookManager.setFilter([]);
      } else {
        // Toggle this status tab
        document.querySelector('.filter-tab[data-status="all"]').classList.remove('active');
        tab.classList.toggle('active');
        // Build array of active statuses
        const activeStatuses = [];
        document.querySelectorAll('.filter-tab.active').forEach(t => {
          if (t.dataset.status !== 'all') activeStatuses.push(t.dataset.status);
        });
        // If nothing selected, re-activate "All"
        if (activeStatuses.length === 0) {
          document.querySelector('.filter-tab[data-status="all"]').classList.add('active');
        }
        BookManager.setFilter(activeStatuses);
        // Auto-sort by progress when only "Reading" is selected
        if (activeStatuses.length === 1 && activeStatuses[0] === 'reading') {
          BookManager.setSort('progress');
          document.getElementById('sort-select').value = 'progress';
        }
      }
      renderBooks();
      renderActiveFilterPills();
    });
  });

  // Genre/Topic/Audiobook filters
  document.getElementById('genre-filter').addEventListener('change', (e) => {
    BookManager.setGenreFilter(e.target.value);
    renderBooks();
    renderActiveFilterPills();
  });
  document.getElementById('topic-filter').addEventListener('change', (e) => {
    BookManager.setTopicFilter(e.target.value);
    renderBooks();
    renderActiveFilterPills();
  });
  document.getElementById('audiobook-filter').addEventListener('change', (e) => {
    BookManager.setAudiobookFilter(e.target.value);
    renderBooks();
    renderActiveFilterPills();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    BookManager.setSort(e.target.value);
    renderBooks();
    renderActiveFilterPills();
  });

  // Extra filters toggle
  document.getElementById('toggle-extra-filters').addEventListener('click', () => {
    const panel = document.getElementById('extra-filters');
    const btn = document.getElementById('toggle-extra-filters');
    panel.classList.toggle('hidden');
    btn.classList.toggle('active');
  });

  // Cover upload
  document.getElementById('book-cover').addEventListener('change', handleCoverUpload);
  document.getElementById('remove-cover-btn').addEventListener('click', removeCoverPreview);

  // Fetch metadata
  document.getElementById('fetch-metadata-btn').addEventListener('click', fetchBookMetadata);

  // ISBN barcode scanner
  document.getElementById('scan-isbn-btn').addEventListener('click', openScanner);
  document.getElementById('scanner-close-btn').addEventListener('click', closeScanner);

  // Title lookup for cover reuse
  document.getElementById('book-name').addEventListener('input', debounce(handleTitleLookup, 400));
  document.getElementById('lookup-accept-btn').addEventListener('click', acceptLookupSuggestion);
  document.getElementById('lookup-dismiss-btn').addEventListener('click', dismissLookupSuggestion);

  // Settings modal
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('save-goal-btn').addEventListener('click', saveGoal);
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-data-file').click());
  document.getElementById('import-data-file').addEventListener('change', importData);

  // Immersive timer controls
  document.getElementById('timer-start-btn').addEventListener('click', startReadingTimer);
  document.getElementById('timer-pause-btn').addEventListener('click', pauseReadingTimer);
  document.getElementById('timer-stop-btn').addEventListener('click', stopReadingTimer);
  document.getElementById('session-immersive-close').addEventListener('click', closeSessionModal);
  document.getElementById('timer-chip').addEventListener('click', () => {
    // Open immersive view when clicking floating chip
    const bookId = localStorage.getItem('timerBookId');
    if (bookId) {
      openSessionModal(parseInt(bookId));
      showImmersiveTimer();
    }
  });

  // New series button
  document.getElementById('new-series-btn').addEventListener('click', createNewSeries);

  // Auto-fill author when selecting a series
  document.getElementById('book-series').addEventListener('change', (e) => {
    const seriesId = parseInt(e.target.value);
    if (!seriesId || currentAuthors.length > 0) return;
    // Find an existing book in this series to get the author
    const seriesBook = BookManager.books.find(b => b.series_id === seriesId && b.authors && b.authors.length > 0);
    if (seriesBook) {
      currentAuthors = [...seriesBook.authors];
      renderTagChips('author-chips', () => currentAuthors, (v) => { currentAuthors = v; });
    }
  });

  // Goal widget click → open settings
  // Goal widget: tap = show books list, long-press = settings
  const goalWidget = document.getElementById('goal-widget');
  let goalPressTimer = null;
  goalWidget.addEventListener('pointerdown', () => {
    goalPressTimer = setTimeout(() => { goalPressTimer = 'long'; openSettings(); }, 500);
  });
  goalWidget.addEventListener('pointerup', () => {
    if (goalPressTimer && goalPressTimer !== 'long') {
      clearTimeout(goalPressTimer);
      showBooksReadList();
    }
    goalPressTimer = null;
  });
  goalWidget.addEventListener('pointerleave', () => {
    if (goalPressTimer && goalPressTimer !== 'long') clearTimeout(goalPressTimer);
    goalPressTimer = null;
  });

  // Header overflow menu
  document.getElementById('header-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('header-menu-dropdown');
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    document.getElementById('header-menu-dropdown')?.classList.add('hidden');
  });

  // FAB: Log Reading
  // Log Reading pill on home
  document.getElementById('home-log-reading-btn').addEventListener('click', () => {
    const reading = BookManager.getBooksByStatus('reading');
    const otherBooks = BookManager.books.filter(b =>
      b.status !== 'read' && b.status !== 'reading'
    );
    if (reading.length === 1 && otherBooks.length === 0) {
      openSessionModal(reading[0].id);
    } else {
      showBookPicker(reading, otherBooks);
    }
  });

  // Format select — show/hide fields based on format
  document.getElementById('book-format').addEventListener('change', (e) => {
    updateFormatFields(e.target.value);
  });

  // Finish date precision — swap input type
  document.getElementById('book-finish-date-precision').addEventListener('change', (e) => {
    updateFinishDateInput(e.target.value);
  });

  // Year selector
  document.getElementById('year-selector').addEventListener('change', (e) => {
    const compare = document.getElementById('compare-year-toggle').checked;
    loadYearlyStats(parseInt(e.target.value), compare);
  });

  // Compare year toggle
  document.getElementById('compare-year-toggle').addEventListener('change', (e) => {
    const year = parseInt(document.getElementById('year-selector').value);
    loadYearlyStats(year, e.target.checked);
  });

  // Period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      loadDashboard();
    });
  });

  // View toggle
  document.getElementById('view-compact').addEventListener('click', () => setBookView('compact'));
  document.getElementById('view-expanded').addEventListener('click', () => setBookView('expanded'));
  document.getElementById('view-grid').addEventListener('click', () => setBookView('grid'));

  // Tag autocomplete
  // Genre grid is rendered in openBookModal, not via autocomplete
  setupTagAutocomplete('book-topics', 'topic-suggestions', 'topic-chips', () => currentTopics, (val) => { currentTopics = val; }, () => BookManager.availableTopics);
  setupTagAutocomplete('book-authors', 'author-suggestions', 'author-chips', () => currentAuthors, (val) => { currentAuthors = val; }, () => BookManager.availableAuthors);

  // Session modal
  document.getElementById('session-close-btn').addEventListener('click', closeSessionModal);
  document.getElementById('session-cancel-btn').addEventListener('click', closeSessionModal);
  document.getElementById('session-modal').addEventListener('click', (e) => {
    if (e.target.id === 'session-modal') closeSessionModal();
  });
  document.getElementById('session-form').addEventListener('submit', handleSessionSubmit);

  // Change password
  document.getElementById('change-password-btn')?.addEventListener('click', handleChangePassword);

  // Admin panel event listeners
  if (Auth.isAdmin()) {
    document.getElementById('admin-add-user-btn')?.addEventListener('click', () => openUserModal());
    document.getElementById('user-modal-close')?.addEventListener('click', closeUserModal);
    document.getElementById('user-cancel-btn')?.addEventListener('click', closeUserModal);
    document.getElementById('user-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'user-modal') closeUserModal();
    });
    document.getElementById('user-form')?.addEventListener('submit', handleUserSubmit);
    document.getElementById('reset-pw-close')?.addEventListener('click', closeResetPwModal);
    document.getElementById('reset-pw-cancel')?.addEventListener('click', closeResetPwModal);
    document.getElementById('reset-pw-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'reset-pw-modal') closeResetPwModal();
    });
    document.getElementById('reset-pw-form')?.addEventListener('submit', handleResetPassword);
  }

}

// ============ Tag Autocomplete ============
function setupTagAutocomplete(inputId, suggestionsId, chipsId, getValues, setValues, getSuggestions) {
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
    const matches = suggestions.filter(s =>
      s.toLowerCase().includes(query) && !currentVals.some(v => v.toLowerCase() === s.toLowerCase())
    );

    if (matches.length === 0) {
      suggestionsEl.classList.add('hidden');
      return;
    }

    suggestionsEl.innerHTML = matches.map(m =>
      `<div class="tag-suggestion-item" data-value="${escapeHtml(m)}">${escapeHtml(m)}</div>`
    ).join('');
    suggestionsEl.classList.remove('hidden');

    // Click on suggestion
    suggestionsEl.querySelectorAll('.tag-suggestion-item').forEach(item => {
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
        if (!vals.some(v => v.toLowerCase() === val.toLowerCase())) {
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

function renderTagChips(chipsId, getValues, setValues) {
  const container = document.getElementById(chipsId);
  const values = getValues();
  container.innerHTML = values.map((val, i) =>
    `<span class="tag-chip">${escapeHtml(val)}<button type="button" class="tag-chip-remove" data-index="${i}">×</button></span>`
  ).join('');

  container.querySelectorAll('.tag-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const vals = getValues();
      vals.splice(idx, 1);
      setValues(vals);
      renderTagChips(chipsId, getValues, setValues);
    });
  });
}

// ============ Filter Dropdowns ============
function populateFilterDropdowns() {
  const genreFilter = document.getElementById('genre-filter');
  const topicFilter = document.getElementById('topic-filter');

  genreFilter.innerHTML = `<option value="">${escapeHtml(t('library.allGenres'))}</option>` +
    `<optgroup label="${escapeHtml(getGenreLabel('fiction'))}">` +
    GENRE_HIERARCHY.fiction.map(key => `<option value="${key}">${escapeHtml(getGenreLabel(key))}</option>`).join('') +
    `</optgroup>` +
    `<optgroup label="${escapeHtml(getGenreLabel('nonfiction'))}">` +
    GENRE_HIERARCHY.nonfiction.map(key => `<option value="${key}">${escapeHtml(getGenreLabel(key))}</option>`).join('') +
    `</optgroup>`;

  topicFilter.innerHTML = '<option value="">All Topics</option>' +
    BookManager.availableTopics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

// ============ Active Filter Pills ============
function renderActiveFilterPills() {
  const container = document.getElementById('active-filter-pills');
  if (!container) return;

  const pills = [];
  const sortLabels = {
    'newest': t('library.newestFirst'),
    'title-az': t('library.titleAZ'),
    'title-za': t('library.titleZA'),
    'author': t('library.author'),
    'status': t('library.statusSort'),
    'progress': t('library.progress'),
    'finish-date': t('library.finishDate')
  };

  // Search pill
  if (BookManager.currentSearch) {
    pills.push({
      label: `🔍 "${BookManager.currentSearch}"`,
      clear: () => {
        BookManager.setSearch('');
        document.getElementById('search-input').value = '';
        renderBooks();
        renderActiveFilterPills();
      }
    });
  }

  // Sort pill (only if not default)
  if (BookManager.currentSort !== 'newest') {
    pills.push({
      label: `↕ ${sortLabels[BookManager.currentSort] || BookManager.currentSort}`,
      clear: () => {
        BookManager.setSort('newest');
        document.getElementById('sort-select').value = 'newest';
        renderBooks();
        renderActiveFilterPills();
      }
    });
  }

  // Genre pill
  if (BookManager.currentGenreFilter) {
    pills.push({
      label: `📚 ${getGenreLabel(BookManager.currentGenreFilter)}`,
      clear: () => {
        BookManager.setGenreFilter('');
        document.getElementById('genre-filter').value = '';
        renderBooks();
        renderActiveFilterPills();
      }
    });
  }

  // Topic pill
  if (BookManager.currentTopicFilter) {
    pills.push({
      label: `🏷 ${BookManager.currentTopicFilter}`,
      clear: () => {
        BookManager.setTopicFilter('');
        document.getElementById('topic-filter').value = '';
        renderBooks();
        renderActiveFilterPills();
      }
    });
  }

  // Format pill
  if (BookManager.currentAudiobookFilter !== 'all') {
    const formatLabels = { 'paper': '📕 Paper', 'ebook': '📱 E-book', 'audiobook': '🎧 Audiobook' };
    pills.push({
      label: formatLabels[BookManager.currentAudiobookFilter] || BookManager.currentAudiobookFilter,
      clear: () => {
        BookManager.setAudiobookFilter('all');
        document.getElementById('audiobook-filter').value = 'all';
        renderBooks();
        renderActiveFilterPills();
      }
    });
  }

  // Author pill
  if (BookManager.currentAuthorFilter) {
    pills.push({
      label: `✍ ${BookManager.currentAuthorFilter}`,
      clear: () => {
        BookManager.setAuthorFilter('');
        renderBooks();
        renderActiveFilterPills();
      }
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
        renderBooks();
        renderActiveFilterPills();
      }
    });
  }

  // Render
  container.innerHTML = pills.map((pill, i) =>
    `<span class="filter-pill" data-pill-idx="${i}">${escapeHtml(pill.label)}<button class="filter-pill-remove" data-pill-idx="${i}">×</button></span>`
  ).join('');

  // Attach clear handlers
  container.querySelectorAll('.filter-pill-remove').forEach(btn => {
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

// ============ Filter Tab Counts ============
function updateFilterTabCounts() {
  const counts = {
    'all': BookManager.books.length,
    'want-to-read': 0,
    'up-next': 0,
    'reading': 0,
    'read': 0
  };

  BookManager.books.forEach(book => {
    if (counts[book.status] !== undefined) {
      counts[book.status]++;
    }
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    const status = tab.dataset.status;
    const label = {
      'all': t('library.all'),
      'want-to-read': t('status.wantToRead'),
      'up-next': t('status.upNext'),
      'reading': t('status.reading'),
      'read': t('status.read')
    }[status];
    tab.textContent = `${label} (${counts[status]})`;
  });
}

// ============ View Toggle ============
function setBookView(viewType) {
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

function loadViewPreference() {
  const pref = localStorage.getItem('bokbad_view_pref') || 'compact';
  setBookView(pref);
}

// ============ Load Books ============
async function loadBooks() {
  await BookManager.loadBooks();
  renderHome();
  updateFilterTabCounts();
}

// ============ Home View ============
let currentCarouselIndex = 0;

function renderHome() {
  renderStreakTracker();
  loadGoalWidget();

  const readingBooks = BookManager.getBooksByStatus('reading');
  // Sort by progress descending — most-read first
  readingBooks.sort((a, b) => BookManager.getProgressPercent(b) - BookManager.getProgressPercent(a));
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
    container.innerHTML = readingBooks.map((book, i) => {
      const card = createHomeCard(book, true, true);
      return `<div class="carousel-slide" data-index="${i}">${card}</div>`;
    }).join('');

    // Dots
    if (readingBooks.length > 1) {
      dotsEl.innerHTML = readingBooks.map((_, i) =>
        `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}"></button>`
      ).join('');
      dotsEl.querySelectorAll('.carousel-dot').forEach(dot => {
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
    upNextContainer.innerHTML = '<div class="empty-state-inline"><span class="empty-state-inline-icon">⏭️</span>No books queued up yet</div>';
  } else {
    upNextContainer.innerHTML = upNextBooks.map(book => {
      const cover = book.cover_image
        ? `<img class="up-next-thumb-img" src="${book.cover_image}" alt="" />`
        : `<div class="up-next-thumb-placeholder">📖</div>`;
      const title = escapeHtml(book.name);
      return `<div class="up-next-thumb" data-book-id="${book.id}">${cover}<div class="up-next-thumb-title">${title}</div></div>`;
    }).join('');
    upNextContainer.querySelectorAll('.up-next-thumb').forEach(el => {
      el.addEventListener('click', () => openDetailModal(parseInt(el.dataset.bookId)));
    });
  }

  // Add click listeners for carousel cards
  document.querySelectorAll('.home-card').forEach(card => {
    card.addEventListener('click', () => {
      const bookId = parseInt(card.dataset.bookId);
      openDetailModal(bookId);
    });
  });

  // --- Log Reading pill: Show if there are non-read books ---
  const logBtn = document.getElementById('home-log-reading-btn');
  const allNonRead = BookManager.books.filter(b => b.status !== 'read');
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

// Book picker for log reading — reading books primary, other books secondary
function showBookPicker(readingBooks, otherBooks) {
  // Remove existing picker
  const existing = document.querySelector('.book-picker-dropdown');
  if (existing) { existing.remove(); return; }

  const wrapper = document.getElementById('home-view');
  const dropdown = document.createElement('div');
  dropdown.className = 'book-picker-dropdown';
  dropdown.style.position = 'fixed';
  dropdown.style.bottom = '140px';
  dropdown.style.right = '16px';
  dropdown.style.zIndex = '200';

  const renderItem = (book, isOther = false) => `
    <button class="book-picker-item${isOther ? ' book-picker-other' : ''}" data-book-id="${book.id}" data-needs-promote="${isOther}">
      ${book.cover_image
      ? `<img src="${book.cover_image}" alt="" class="book-picker-thumb" />`
      : '<div class="book-picker-thumb-placeholder">📖</div>'
    }
      <span class="book-picker-name">${escapeHtml(book.name)}</span>
    </button>
  `;

  let html = '';
  if (readingBooks.length > 0) {
    html += readingBooks.map(b => renderItem(b, false)).join('');
  }
  if (otherBooks.length > 0) {
    if (readingBooks.length > 0) {
      html += '<div class="book-picker-divider">' + t('home.otherBooks') + '</div>';
    }
    html += otherBooks.map(b => renderItem(b, true)).join('');
  }

  dropdown.innerHTML = html;
  wrapper.appendChild(dropdown);

  dropdown.querySelectorAll('.book-picker-item').forEach(item => {
    item.addEventListener('click', async () => {
      const bookId = parseInt(item.dataset.bookId);
      const needsPromote = item.dataset.needsPromote === 'true';
      dropdown.remove();

      if (needsPromote) {
        // Auto-promote to "reading"
        const result = await BookManager.updateBook({ id: bookId, status: 'reading' });
        if (result.success) {
          showToast(t('toast.bookMovedReading'), 'success');
          renderHome();
          renderBooks();
          updateFilterTabCounts();
        }
      }
      openSessionModal(bookId);
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
async function renderStreakTracker() {
  const container = document.getElementById('streak-tracker');
  if (!container) return;

  try {
    const result = await API.getStreakData(10);
    if (!result.success) {
      container.innerHTML = '';
      return;
    }

    const { days, streak, todayRead } = result;
    const showFlame = streak >= 3;

    let dotsHtml = days.map((day, i) => {
      const isToday = i === days.length - 1;
      const classes = ['streak-dot'];
      if (day.read) classes.push('active');
      if (isToday) classes.push('today');
      // Show weekday initial
      const date = new Date(day.date + 'T12:00:00');
      const dayLabel = date.toLocaleDateString('en', { weekday: 'narrow' });
      return `<div class="${classes.join(' ')}" title="${day.date}"><span class="streak-day-label">${dayLabel}</span></div>`;
    }).join('');

    const flameHtml = showFlame ? '<span class="streak-flame">🔥</span>' : '';
    const streakText = streak > 0
      ? `<span class="streak-count">${t('home.dayStreak', { count: streak })} ${flameHtml}</span>`
      : '<span class="streak-count streak-count-zero">' + t('home.startStreak') + '</span>';

    container.innerHTML = `
      <div class="streak-dots" style="cursor:pointer" id="streak-dots-tap">${dotsHtml}</div>
      ${streakText}
    `;
    // Make tappable to open calendar
    container.querySelector('#streak-dots-tap')?.addEventListener('click', () => openActivityCalendar());
  } catch (error) {
    console.error('Failed to load streak data:', error);
    container.innerHTML = '';
  }
}

// ============ Activity Calendar ============
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth() + 1;

function openActivityCalendar() {
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth() + 1;
  const modal = document.getElementById('calendar-modal');
  modal.classList.remove('hidden');
  renderCalendarMonth(calendarYear, calendarMonth);
}

async function renderCalendarMonth(year, month) {
  const body = document.getElementById('calendar-body');
  body.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const result = await API.getActivityCalendar(year, month);
    if (!result.success) { body.innerHTML = ''; return; }

    const { sessions, streak, daysRead, totalSessions } = result;
    const monthNames = t('calendar.monthNames');

    // First day of month (0=Sun..6=Sat) → shift to Mon=0
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0, Sun=6

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Build grid cells
    let gridHtml = '';
    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      gridHtml += '<div class="cal-cell cal-empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasSession = sessions[dateStr];
      const isToday = dateStr === todayStr;
      const isFuture = new Date(dateStr) > today;
      const classes = ['cal-cell'];
      if (hasSession) classes.push('cal-active');
      if (isToday) classes.push('cal-today');
      if (isFuture) classes.push('cal-future');

      let tooltip = '';
      if (hasSession) {
        const parts = [];
        if (hasSession.pages > 0) parts.push(`${hasSession.pages}p`);
        if (hasSession.minutes > 0) parts.push(`${hasSession.minutes}min`);
        tooltip = parts.join(', ');
      }

      gridHtml += `<div class="${classes.join(' ')}" ${tooltip ? `title="${tooltip}"` : ''}><span class="cal-day">${d}</span></div>`;
    }

    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

    body.innerHTML = `
      <div class="cal-nav">
        <button class="btn-icon cal-prev" aria-label="Previous month">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="cal-month-label">${monthNames[month]} ${year}</span>
        <button class="btn-icon cal-next ${isCurrentMonth ? 'cal-disabled' : ''}" aria-label="Next month" ${isCurrentMonth ? 'disabled' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
        </button>
      </div>
      <div class="cal-stats">
        <div class="cal-stat">
          <span class="cal-stat-val">${streak}</span>
          <span class="cal-stat-label">${t('calendar.dayStreak')}</span>
        </div>
        <div class="cal-stat">
          <span class="cal-stat-val">${daysRead}</span>
          <span class="cal-stat-label">${t('calendar.daysRead')}</span>
        </div>
        <div class="cal-stat">
          <span class="cal-stat-val">${totalSessions}</span>
          <span class="cal-stat-label">${t('calendar.sessions')}</span>
        </div>
      </div>
      <div class="cal-grid">
        ${t('calendar.dayHeaders').map(d => `<div class="cal-header">${d}</div>`).join('')}
        ${gridHtml}
      </div>
    `;

    // Nav handlers
    body.querySelector('.cal-prev')?.addEventListener('click', () => {
      calendarMonth--;
      if (calendarMonth < 1) { calendarMonth = 12; calendarYear--; }
      renderCalendarMonth(calendarYear, calendarMonth);
    });
    body.querySelector('.cal-next')?.addEventListener('click', () => {
      if (isCurrentMonth) return;
      calendarMonth++;
      if (calendarMonth > 12) { calendarMonth = 1; calendarYear++; }
      renderCalendarMonth(calendarYear, calendarMonth);
    });
  } catch (error) {
    console.error('Failed to load calendar:', error);
    body.innerHTML = '<div class="empty-state-text">' + t('calendar.failedToLoad') + '</div>';
  }
}

function createHomeCard(book, isReading, isFeatured = false) {
  const coverImg = book.cover_image
    ? `<img src="${book.cover_image}" alt="${escapeHtml(book.name)}" class="home-card-cover" />`
    : `<div class="home-card-cover-placeholder">📖</div>`;

  const authorsHtml = book.authors && book.authors.length > 0
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

// ============ Library View ============
function renderBooks() {
  const container = document.getElementById('books-container');
  const books = BookManager.getFilteredBooks();

  if (books.length === 0) {
    const hasFilters = BookManager.currentSearch || BookManager.currentFilter.length > 0 || BookManager.currentGenreFilter || BookManager.currentTopicFilter || BookManager.currentAuthorFilter || BookManager.currentAudiobookFilter !== 'all';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${hasFilters ? '🔍' : '📚'}</div>
        <p>${hasFilters ? t('library.noMatches') : t('library.emptyLibrary')}</p>
        ${hasFilters ? '' : `<button class="btn btn-primary" onclick="document.getElementById('add-book-btn').click()">${t('library.addBook')}</button>`}
      </div>
    `;
    return;
  }

  container.innerHTML = books.map(book => createBookCard(book)).join('');

  // Add click listeners — opens detail view (on inner content only to avoid swipe conflicts)
  container.querySelectorAll('.book-card').forEach(card => {
    const clickTarget = card.querySelector('.book-card-inner') || card;
    clickTarget.addEventListener('click', (e) => {
      // Don't open if we just finished swiping
      if (clickTarget.style.transform && clickTarget.style.transform !== 'translateX(0px)' && clickTarget.style.transform !== 'translateX(0)') return;
      const bookId = parseInt(card.dataset.bookId);
      openDetailModal(bookId);
    });
  });

  // Attach swipe handlers
  attachSwipeHandlers(container);
}

function createBookCard(book) {
  const statusLabel = {
    'want-to-read': t('status.wantToRead'),
    'up-next': t('status.upNext'),
    'reading': t('status.reading'),
    'read': t('status.read')
  }[book.status];

  const coverImg = book.cover_image
    ? `<img src="${book.cover_image}" alt="${escapeHtml(book.name)}" class="book-cover" />`
    : `<div class="book-cover-placeholder">📖</div>`;

  // Format overlay badge on cover
  let formatOverlay = '';
  if (book.format === 'audiobook') {
    formatOverlay = '<span class="cover-format-badge">🎧</span>';
  } else if (book.format === 'ebook') {
    formatOverlay = '<span class="cover-format-badge">📱</span>';
  }

  const coverHtml = `<div class="book-cover-wrap">${coverImg}${formatOverlay}</div>`;

  const authorsHtml = book.authors && book.authors.length > 0
    ? `<div class="book-authors">${escapeHtml(book.authors.join(', '))}</div>`
    : '';

  const genresHtml = book.genres && book.genres.length > 0
    ? book.genres.map(g => `<span class="tag tag-genre">${escapeHtml(getGenreLabel(g))}</span>`).join('')
    : '';

  const topicsHtml = book.topics && book.topics.length > 0
    ? book.topics.map(t => `<span class="tag tag-topic">${escapeHtml(t)}</span>`).join('')
    : '';

  const tagsHtml = (genresHtml || topicsHtml)
    ? `<div class="book-tags">${genresHtml}${topicsHtml}</div>`
    : '';
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

// ============ Detail Modal ============
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

function openDetailModal(bookId) {
  const book = BookManager.getBook(bookId);
  if (!book) return;

  const modal = document.getElementById('detail-modal');
  modal.dataset.bookId = bookId;

  const statusLabel = {
    'want-to-read': t('status.wantToRead'),
    'up-next': t('status.upNext'),
    'reading': t('status.reading'),
    'read': t('status.read')
  }[book.status];

  const coverHtml = book.cover_image
    ? `<img src="${book.cover_image}" alt="${escapeHtml(book.name)}" class="detail-cover" />`
    : `<div class="detail-cover-placeholder">📖</div>`;

  const authorsText = book.authors && book.authors.length > 0
    ? book.authors.map(a => `<span class="detail-author-link" data-author="${escapeHtml(a)}">${escapeHtml(a)}</span>`).join(', ')
    : '';

  const formatLabel = { 'paper': '📕 Paper', 'ebook': '📱 E-book', 'audiobook': '🎧 Audio' }[book.format || 'paper'];

  // Tags (genres + topics combined inline)
  const allTags = [];
  if (book.genres) allTags.push(...book.genres.map(g => `<span class="tag tag-genre detail-tag-link" data-genre="${escapeHtml(g)}">${escapeHtml(getGenreLabel(g))}</span>`));
  if (book.topics) allTags.push(...book.topics.map(t => `<span class="tag tag-topic detail-tag-link" data-topic="${escapeHtml(t)}">${escapeHtml(t)}</span>`));
  const tagsHtml = allTags.length > 0
    ? `<div class="detail-tags-row">${allTags.join('')}</div>`
    : '';

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
  if (book.finish_date) dateItems.push(`✅ ${formatDate(book.finish_date, book.finish_date_precision || 'day')}`);
  const datesHtml = dateItems.length > 0
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
        <textarea id="detail-notes-textarea" class="detail-notes-textarea" placeholder="**Bold**, *italic*, # Heading, - List">${book.thoughts || ''}</textarea>
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
      navigateToLibraryWithFilter({ status: badge.dataset.status });
    });
  }

  // Clickable author links
  body.querySelectorAll('.detail-author-link').forEach(el => {
    el.addEventListener('click', () => {
      navigateToLibraryWithFilter({ author: el.dataset.author });
    });
  });

  // Clickable genre/topic tags
  body.querySelectorAll('.detail-tag-link').forEach(el => {
    if (el.dataset.genre) {
      el.addEventListener('click', () => navigateToLibraryWithFilter({ genre: el.dataset.genre }));
    } else if (el.dataset.topic) {
      el.addEventListener('click', () => navigateToLibraryWithFilter({ topic: el.dataset.topic }));
    }
  });

  // Clickable series chip
  const seriesLink = body.querySelector('.detail-series-link');
  if (seriesLink) {
    seriesLink.addEventListener('click', () => {
      const seriesId = parseInt(seriesLink.dataset.seriesId);
      const seriesName = seriesLink.dataset.series;
      navigateToLibraryWithFilter({ series: { id: seriesId, name: seriesName } });
    });
  }

  // Notes edit/save/cancel
  const editBtn = body.querySelector('.detail-notes-edit-btn');
  const editor = body.querySelector('#detail-notes-editor');
  const display = body.querySelector('#detail-notes-display');
  const textarea = body.querySelector('#detail-notes-textarea');
  const cancelBtn = body.querySelector('.detail-notes-cancel');
  const saveBtn = body.querySelector('.detail-notes-save');

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
        openDetailModal(bookId);
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
          ${result.sessions.map(s => {
        let metricHtml = '';
        if (format === 'audiobook') {
          // Show duration in hh:mm format for audiobooks
          metricHtml = s.duration_minutes ? `<span class="session-pages">🎧 ${formatDuration(s.duration_minutes)}</span>` : '';
        } else {
          metricHtml = `<span class="session-pages">p. ${s.pages_read}</span>`;
          if (s.duration_minutes) metricHtml += ` <span class="session-duration">${s.duration_minutes}min</span>`;
        }
        return `
            <div class="session-item">
              <span class="session-date">${formatDateRelative(s.session_date)}</span>
              ${metricHtml}
              ${s.notes ? `<span class="session-notes">${escapeHtml(s.notes)}</span>` : ''}
            </div>
          `}).join('')}
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  } catch {
    container.innerHTML = '';
  }
}

// Quick status change
async function handleQuickStatusChange(bookId) {
  const book = BookManager.getBook(bookId);
  if (!book) return;

  const statusFlow = ['want-to-read', 'up-next', 'reading', 'read'];
  const currentIndex = statusFlow.indexOf(book.status);
  const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];

  const result = await BookManager.updateBook({ id: bookId, status: nextStatus });
  if (result.success) {
    showToast(t('toast.statusChangedTo', { status: nextStatus.replace(/-/g, ' ') }), 'success');
    await BookManager.loadBooks();
    updateFilterTabCounts();
    openDetailModal(bookId); // Refresh detail view
    renderHome();
    renderBooks();
  } else {
    showToast(result.error || t('toast.statusFailed'), 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  modal.classList.add('modal-closing');
  modal.addEventListener('animationend', () => {
    modal.classList.add('hidden');
    modal.classList.remove('modal-closing');
  }, { once: true });
}

// Navigate to library with a specific filter applied
function navigateToLibraryWithFilter({ author, status, genre, topic, search, series } = {}) {
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
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
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
    // Store the name for the pill display
    BookManager._seriesFilterName = series.name;
  }

  // Close detail modal and navigate to library
  closeDetailModal();
  switchView('library');
  renderActiveFilterPills();
}

// ============ Reading Session Modal ============
function openSessionModal(bookId) {
  const book = BookManager.getBook(bookId);
  if (!book) return;

  const modal = document.getElementById('session-modal');
  const form = document.getElementById('session-form');
  form.reset();

  document.getElementById('session-book-id').value = bookId;
  document.getElementById('session-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('session-error').textContent = '';

  // Populate cover art
  const coverUrl = book.cover_image || '';
  const bgEl = document.getElementById('session-bg-cover');
  bgEl.style.backgroundImage = coverUrl ? `url(${coverUrl})` : 'none';

  const coverImg = document.getElementById('session-book-cover-img');
  if (coverUrl) {
    coverImg.src = coverUrl;
    coverImg.alt = escapeHtml(book.name);
    coverImg.style.display = '';
  } else {
    coverImg.style.display = 'none';
  }

  // Form book header
  document.getElementById('session-book-name').textContent = book.name;
  const format = book.format || 'paper';
  let progressInfo = '';
  if (format === 'paper' && book.total_pages) {
    progressInfo = t('session.pagesProgress', { current: book.current_page || 0, total: book.total_pages });
  } else if (format === 'audiobook' && book.total_duration_min) {
    progressInfo = `${formatDuration(book.current_duration_min || 0)} / ${formatDuration(book.total_duration_min)}`;
  } else if (format === 'ebook') {
    progressInfo = t('session.percentProgress', { percent: book.current_percentage || 0 });
  }
  document.getElementById('session-book-pages').textContent = progressInfo;

  // Immersive timer info
  document.getElementById('session-timer-title').textContent = book.name;
  const authors = Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors || '');
  document.getElementById('session-timer-author').textContent = authors;
  document.getElementById('session-timer-progress').textContent = progressInfo;

  // Adapt label & placeholder based on format
  const label = document.getElementById('session-input-label');
  const input = document.getElementById('session-pages');
  const durationGroup = document.getElementById('session-duration-group');
  const pagesGroup = document.getElementById('session-pages-group');
  const audiobookPositionGroup = document.getElementById('session-audiobook-position-group');
  const positionHint = document.getElementById('session-position-hint');

  // Reset visibility
  pagesGroup.classList.remove('hidden');
  audiobookPositionGroup.classList.add('hidden');
  input.required = false;

  if (format === 'paper') {
    label.textContent = t('session.pageReached');
    input.placeholder = t('session.pageCurrently', { page: book.current_page || 0 });
    input.step = '1';
    input.required = true;
    durationGroup.style.display = '';
  } else if (format === 'audiobook') {
    // Hide the regular pages input, show hh:mm position input
    pagesGroup.classList.add('hidden');
    audiobookPositionGroup.classList.remove('hidden');
    durationGroup.style.display = 'none';
    // Pre-fill current position
    const currentMin = book.current_duration_min || 0;
    document.getElementById('session-position-hours').value = Math.floor(currentMin / 60) || '';
    document.getElementById('session-position-minutes').value = currentMin % 60 || '';
    // Show hint with current and total
    const totalDur = book.total_duration_min ? formatDuration(book.total_duration_min) : '?';
    positionHint.textContent = t('session.timeCurrently', { time: formatDuration(currentMin) }) + (book.total_duration_min ? ` / ${totalDur}` : '');
  } else if (format === 'ebook') {
    label.textContent = t('session.percentComplete');
    input.placeholder = t('session.percentCurrently', { percent: book.current_percentage || 0 });
    input.step = '0.1';
    input.max = '100';
    input.required = true;
    durationGroup.style.display = '';
  }

  // If timer is running for this book, show immersive view
  const timerBookId = localStorage.getItem('timerBookId');
  const isTimerRunning = !!timerStartTime;
  if (isTimerRunning && timerBookId && parseInt(timerBookId) === bookId) {
    showImmersiveTimer();
  } else {
    // Show form mode
    document.getElementById('session-immersive').classList.add('hidden');
    document.getElementById('session-form-section').classList.remove('hidden');
    // Hide timer button for audiobooks (time is tracked in audiobook app)
    document.getElementById('timer-start-btn').style.display = format === 'audiobook' ? 'none' : '';
  }

  modal.classList.remove('hidden');
}

function closeSessionModal() {
  const modal = document.getElementById('session-modal');
  modal.classList.add('modal-closing');
  modal.addEventListener('animationend', () => {
    modal.classList.add('hidden');
    modal.classList.remove('modal-closing');
  }, { once: true });
}

async function handleSessionSubmit(e) {
  e.preventDefault();

  const bookId = parseInt(document.getElementById('session-book-id').value);
  const sessionDate = document.getElementById('session-date').value;
  const duration = document.getElementById('session-duration').value;
  const notes = document.getElementById('session-notes').value.trim();

  const book = BookManager.getBook(bookId);
  const format = book?.format || 'paper';

  const data = {
    book_id: bookId,
    session_date: sessionDate || undefined,
    notes: notes || undefined
  };

  if (format === 'paper') {
    const inputValue = parseFloat(document.getElementById('session-pages').value);
    if (!inputValue) {
      document.getElementById('session-error').textContent = t('session.pageReached');
      return;
    }
    data.pages_read = inputValue;
    data.duration_minutes = duration ? parseInt(duration) : undefined;
  } else if (format === 'audiobook') {
    // Read hh:mm position inputs and convert to total minutes
    const posHours = parseInt(document.getElementById('session-position-hours').value) || 0;
    const posMinutes = parseInt(document.getElementById('session-position-minutes').value) || 0;
    const newPositionMin = posHours * 60 + posMinutes;
    if (newPositionMin <= 0) {
      document.getElementById('session-error').textContent = t('session.currentPosition');
      return;
    }
    // Send absolute position as duration_minutes — backend handles it as absolute
    data.duration_minutes = newPositionMin;
  } else if (format === 'ebook') {
    const inputValue = parseFloat(document.getElementById('session-pages').value);
    if (inputValue === undefined || inputValue === null || isNaN(inputValue)) {
      document.getElementById('session-error').textContent = t('session.percentComplete');
      return;
    }
    data.percentage = inputValue;
    data.duration_minutes = duration ? parseInt(duration) : undefined;
  }

  try {
    const result = await API.createReadingSession(data);
    if (result.success) {
      // Update the book's progress locally
      if (book) {
        if (result.current_page !== undefined) book.current_page = result.current_page;
        if (result.current_duration_min !== undefined) book.current_duration_min = result.current_duration_min;
        if (result.current_percentage !== undefined) book.current_percentage = result.current_percentage;
      }

      // Append session notes to book's Notes & Highlights
      if (notes && book) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
        const header = `## Reading session ${dateStr} - ${timeStr}`;
        const newEntry = `${header}\n${notes}`;
        const updatedThoughts = book.thoughts
          ? `${book.thoughts}\n\n${newEntry}`
          : newEntry;
        await BookManager.updateBook({ id: bookId, thoughts: updatedThoughts });
      }

      closeSessionModal();
      showToast(t('toast.sessionLogged'), 'success');
      renderHome();
    } else {
      document.getElementById('session-error').textContent = result.error || t('toast.sessionFailed');
    }
  } catch {
    showToast(t('toast.sessionFailed'), 'error');
  }
}

// ============ Book Modal (Add/Edit) ============
function openBookModal(bookId = null) {
  const modal = document.getElementById('book-modal');
  const form = document.getElementById('book-form');
  const title = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('delete-book-btn');

  form.reset();
  currentUploadedCoverUrl = null;
  currentGenres = [];
  currentTopics = [];
  currentAuthors = [];
  lookupDismissed = false;
  pendingLookupResult = null;
  document.getElementById('book-lookup-banner').classList.add('hidden');
  removeCoverPreview();
  renderGenreSelectGrid([]);
  renderTagChips('topic-chips', () => currentTopics, (v) => { currentTopics = v; });
  renderTagChips('author-chips', () => currentAuthors, (v) => { currentAuthors = v; });
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
    renderTagChips('topic-chips', () => currentTopics, (v) => { currentTopics = v; });
    renderTagChips('author-chips', () => currentAuthors, (v) => { currentAuthors = v; });

    if (book.cover_image) {
      showCoverPreview(book.cover_image);
      currentUploadedCoverUrl = book.cover_image;
    }
    // Series
    populateSeriesDropdown(book.series_id);
    document.getElementById('book-series-order').value = book.series_order || '';

    // Auto-open collapsible sections when they have data
    const detailsSection = form.querySelectorAll('.form-section');
    if (detailsSection.length >= 2) {
      // Always open Details in edit mode
      detailsSection[0].open = true;
      // Open Dates & Notes if book has dates or thoughts
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

function closeBookModal() {
  const modal = document.getElementById('book-modal');
  modal.classList.add('modal-closing');
  modal.addEventListener('animationend', () => {
    modal.classList.add('hidden');
    modal.classList.remove('modal-closing');
    document.getElementById('form-error').textContent = '';
    document.getElementById('book-id').value = '';
  }, { once: true });
}

async function handleBookSubmit(e) {
  e.preventDefault();

  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  const bookId = document.getElementById('book-id').value;
  const name = document.getElementById('book-name').value.trim();
  const authorsStr = document.getElementById('book-authors').value.trim();
  // Merge any typed text with chip values
  const typedAuthors = authorsStr ? authorsStr.split(',').map(a => a.trim()).filter(a => a) : [];
  const authors = [...new Set([...currentAuthors, ...typedAuthors])];
  const status = document.getElementById('book-status').value;
  const startDate = document.getElementById('book-start-date').value || null;
  const finishDatePrecision = document.getElementById('book-finish-date-precision').value || 'day';
  const rawFinishDate = document.getElementById('book-finish-date').value || null;
  // Send the raw value - API handles normalization based on precision
  const finishDate = rawFinishDate;
  const thoughts = document.getElementById('book-thoughts').value.trim() || null;
  const isbn = document.getElementById('book-isbn').value.trim() || null;
  const format = document.getElementById('book-format').value;
  const isAudiobook = format === 'audiobook';
  const totalPages = document.getElementById('book-total-pages').value ? parseInt(document.getElementById('book-total-pages').value) : null;
  const durationHours = document.getElementById('book-total-duration-hours').value ? parseInt(document.getElementById('book-total-duration-hours').value) : 0;
  const durationMins = document.getElementById('book-total-duration-minutes').value ? parseInt(document.getElementById('book-total-duration-minutes').value) : 0;
  const totalDurationMin = (durationHours || durationMins) ? (durationHours * 60 + durationMins) : null;


  // Current progress fields
  const currentPage = document.getElementById('book-current-page').value ? parseInt(document.getElementById('book-current-page').value) : 0;
  const curDurationHours = document.getElementById('book-current-duration-hours').value ? parseInt(document.getElementById('book-current-duration-hours').value) : 0;
  const curDurationMins = document.getElementById('book-current-duration-minutes').value ? parseInt(document.getElementById('book-current-duration-minutes').value) : 0;
  const currentDurationMin = (curDurationHours || curDurationMins) ? (curDurationHours * 60 + curDurationMins) : 0;
  const currentPercentage = document.getElementById('book-current-percentage').value ? parseFloat(document.getElementById('book-current-percentage').value) : 0;

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
    seriesId: document.getElementById('book-series').value ? parseInt(document.getElementById('book-series').value) : null,
    seriesOrder: document.getElementById('book-series-order').value ? parseInt(document.getElementById('book-series-order').value) : null
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
    populateFilterDropdowns();
    updateFilterTabCounts();
    renderHome();
    renderBooks();
  } else {
    errorEl.textContent = result.error;
  }
}

async function handleBookDelete() {
  const bookId = document.getElementById('book-id').value;
  if (!bookId) return;

  if (!confirm(t('toast.deleteConfirm'))) return;

  const result = await BookManager.deleteBook(parseInt(bookId));

  if (result.success) {
    closeBookModal();
    showToast(t('toast.bookDeleted'), 'info');
    await BookManager.loadBooks();
    updateFilterTabCounts();
    renderHome();
    renderBooks();
  } else {
    document.getElementById('form-error').textContent = result.error;
  }
}

// ============ Cover Upload ============
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
      currentUploadedCoverUrl = result.url;
      showCoverPreview(result.url);
    } else {
      showToast(result.error || t('toast.uploadFailed'), 'error');
    }
  } catch (error) {
    showToast(t('toast.uploadFailed'), 'error');
    console.error(error);
  }
}

function showCoverPreview(url) {
  const preview = document.getElementById('cover-preview');
  const img = document.getElementById('cover-preview-img');
  img.src = url;
  preview.classList.remove('hidden');
}

function removeCoverPreview() {
  const preview = document.getElementById('cover-preview');
  preview.classList.add('hidden');
  currentUploadedCoverUrl = null;
  document.getElementById('book-cover').value = '';
}

// ============ ISBN Barcode Scanner ============
let activeScanner = null;

async function openScanner() {
  const overlay = document.getElementById('scanner-overlay');
  overlay.classList.remove('hidden');

  try {
    activeScanner = new Html5Qrcode('scanner-viewfinder');
    await activeScanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] // All barcode formats
      },
      (decodedText) => {
        // Only accept ISBN-like codes (10 or 13 digits)
        const cleaned = decodedText.replace(/[-\s]/g, '');
        if (/^\d{10}(\d{3})?$/.test(cleaned)) {
          document.getElementById('book-isbn').value = cleaned;
          closeScanner();
          showToast(t('toast.isbnScanned', { isbn: cleaned }), 'success');
          // Auto-trigger metadata fetch
          fetchBookMetadata();
        }
      },
      () => { } // Ignore failures (continuous scanning)
    );
  } catch (error) {
    console.error('Scanner error:', error);
    showToast(t('toast.cameraFailed'), 'error');
    closeScanner();
  }
}

async function closeScanner() {
  const overlay = document.getElementById('scanner-overlay');
  overlay.classList.add('hidden');

  if (activeScanner) {
    try {
      await activeScanner.stop();
    } catch { }
    activeScanner = null;
  }
  // Clear the viewfinder HTML left by the library
  document.getElementById('scanner-viewfinder').innerHTML = '';
}

// ============ Title Lookup for Cover Reuse ============
let lookupDismissed = false;
let pendingLookupResult = null;

async function handleTitleLookup() {
  const name = document.getElementById('book-name').value.trim();
  const bookId = document.getElementById('book-id').value;
  const banner = document.getElementById('book-lookup-banner');

  // Skip in edit mode, if dismissed, if cover already set, or if name too short
  if (bookId || lookupDismissed || currentUploadedCoverUrl || name.length < 3) {
    banner.classList.add('hidden');
    return;
  }

  try {
    const result = await API.lookupBook(name);
    if (result.success && result.book && result.book.coverImage) {
      pendingLookupResult = result.book;
      document.getElementById('lookup-banner-img').src = result.book.coverImage;
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

function acceptLookupSuggestion() {
  if (!pendingLookupResult) return;

  const book = pendingLookupResult;

  // Set cover
  if (book.coverImage) {
    currentUploadedCoverUrl = book.coverImage;
    showCoverPreview(book.coverImage);
  }

  // Auto-fill authors if empty
  if (book.authors && book.authors.length > 0 && currentAuthors.length === 0) {
    currentAuthors = [...book.authors];
    renderTagChips('author-chips', () => currentAuthors, (v) => { currentAuthors = v; });
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

function dismissLookupSuggestion() {
  lookupDismissed = true;
  document.getElementById('book-lookup-banner').classList.add('hidden');
  pendingLookupResult = null;
}

// ============ ISBN Metadata Fetch ============
async function fetchBookMetadata() {
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
        currentAuthors = [...meta.authors];
        renderTagChips('author-chips', () => currentAuthors, (v) => { currentAuthors = v; });
        document.getElementById('book-authors').value = '';
      }
      if (meta.categories && meta.categories.length > 0) {
        currentTopics = [...new Set([...currentTopics, ...meta.categories])];
        renderTagChips('topic-chips', () => currentTopics, (v) => { currentTopics = v; });
      }
      if (meta.pageCount) {
        document.getElementById('book-total-pages').value = meta.pageCount;
      }
      if (meta.coverImage) {
        // Cache the remote cover image locally to avoid lag on every page load
        try {
          const proxyResult = await API.proxyCover(meta.coverImage);
          if (proxyResult.success && proxyResult.url) {
            currentUploadedCoverUrl = proxyResult.url;
            showCoverPreview(proxyResult.url);
          } else {
            // Fallback to remote URL if proxy fails
            currentUploadedCoverUrl = meta.coverImage;
            showCoverPreview(meta.coverImage);
          }
        } catch {
          // Fallback to remote URL
          currentUploadedCoverUrl = meta.coverImage;
          showCoverPreview(meta.coverImage);
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

// ============ Dashboard ============
let currentPeriod = '30d';

function getDateRange(period) {
  const now = new Date();
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split('T')[0] };
  }
  if (period === '12m') {
    const past = new Date(now);
    past.setMonth(past.getMonth() - 12);
    return { from: past.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
  }
  if (period === '30d') {
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    return { from: past.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
  }
  return { from: null, to: null };
}

async function loadDashboard() {
  const { from, to } = getDateRange(currentPeriod);
  const is30d = currentPeriod === '30d';

  // Toggle chart visibility
  document.getElementById('daily-chart-container').classList.toggle('hidden', !is30d);
  document.getElementById('monthly-chart-container').classList.toggle('hidden', is30d);
  document.getElementById('genre-chart-container').style.display = is30d ? 'none' : '';

  // Single unified stats call for all periods
  const statsPromise = loadUnifiedStats(from, to);

  if (is30d) {
    await statsPromise;
  } else {
    await Promise.all([
      statsPromise,
      loadYearlyStats(new Date().getFullYear(), false),
      loadGenreChart()
    ]);
    populateYearSelector();
  }
}

async function loadUnifiedStats(from, to) {
  try {
    const result = await API.getDashboardStats(from, to);
    if (!result.success) return;

    const { counts, totalPages, readMinutes, listenMinutes, avgDaysToFinish, booksPerMonth, streak, daily } = result;

    // Status pills
    document.getElementById('stat-read').textContent = counts.read;
    document.getElementById('stat-reading').textContent = counts.reading;
    document.getElementById('stat-upnext').textContent = counts.upNext || 0;
    document.getElementById('stat-want').textContent = counts.wantToRead;

    // Metric tiles (consistent across all periods)
    document.getElementById('stat-pace').textContent = avgDaysToFinish !== null ? avgDaysToFinish : '—';
    document.getElementById('stat-per-month').textContent = booksPerMonth;
    document.getElementById('stat-pages').textContent = totalPages > 0 ? totalPages.toLocaleString() : '0';
    document.getElementById('stat-streak').textContent = streak;

    // Read time (paper + ebook sessions)
    if (readMinutes > 0) {
      const rh = Math.floor(readMinutes / 60);
      const rm = readMinutes % 60;
      document.getElementById('stat-read-time').textContent = rm > 0 ? `${rh}h ${rm}m` : `${rh}h`;
    } else {
      document.getElementById('stat-read-time').textContent = '—';
    }

    // Listen time (audiobook sessions)
    if (listenMinutes > 0) {
      const lh = Math.floor(listenMinutes / 60);
      const lm = listenMinutes % 60;
      document.getElementById('stat-listen-time').textContent = lm > 0 ? `${lh}h ${lm}m` : `${lh}h`;
    } else {
      document.getElementById('stat-listen-time').textContent = '—';
    }

    // Render daily chart if we have daily data (30d view)
    if (daily && daily.length > 0) {
      renderDailyChart(daily);
    }
  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
  }
}

async function loadYearlyStats(year, compare = false) {
  try {
    const result = await API.getYearlyStats(year, compare);
    if (result.success) {
      renderChart(result.monthlyBreakdown, compare ? result.previousMonthlyBreakdown : null, compare ? result.previousYear : null);
    }
  } catch (error) {
    console.error('Failed to load yearly stats:', error);
  }
}

async function loadGenreChart() {
  try {
    const result = await API.getGenreStats();
    if (result.success && result.genres.length > 0) {
      renderGenreChart(result.genres);
    } else {
      document.getElementById('genre-chart-container').style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load genre stats:', error);
    document.getElementById('genre-chart-container').style.display = 'none';
  }
}

// ============ Charts ============
function renderChart(monthlyData, prevYearData = null, prevYear = null) {
  const ctx = document.getElementById('monthly-chart');

  if (currentChart) {
    currentChart.destroy();
  }

  const labels = t('calendar.chartMonths');
  const data = monthlyData.map(m => m.count);

  const datasets = [{
    label: t('dashboard.booksReadChart'),
    data,
    backgroundColor: '#6366f1',
    borderRadius: 4
  }];

  // Add previous year comparison line
  if (prevYearData && prevYear) {
    datasets.push({
      label: `${prevYear}`,
      data: prevYearData.map(m => m.count),
      type: 'line',
      borderColor: '#a5b4fc',
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#a5b4fc',
      fill: false,
      tension: 0.3
    });
  }

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: !!prevYearData
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderGenreChart(genres) {
  const ctx = document.getElementById('genre-chart');

  if (genreChart) {
    genreChart.destroy();
  }

  // Take top 8 genres
  const topGenres = genres.slice(0, 8);

  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#f97316', '#eab308'
  ];

  genreChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: topGenres.map(g => getGenreLabel(g.name)),
      datasets: [{
        data: topGenres.map(g => g.count),
        backgroundColor: colors.slice(0, topGenres.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

function populateYearSelector() {
  const selector = document.getElementById('year-selector');
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let i = currentYear; i >= currentYear - 10; i--) {
    years.push(i);
  }

  selector.innerHTML = years.map(year =>
    `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
  ).join('');
}

function renderDailyChart(days) {
  const ctx = document.getElementById('daily-activity-chart');

  if (dailyChart) {
    dailyChart.destroy();
  }

  // Format labels as short dates (e.g. "Feb 20")
  const labels = days.map(d => {
    const date = new Date(d.date + 'T12:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: t('dashboard.readingTime'),
          data: days.map(d => d.readMinutes),
          backgroundColor: '#6366f1',
          borderRadius: 2
        },
        {
          label: t('dashboard.listeningTime'),
          data: days.map(d => d.listenMinutes),
          backgroundColor: '#a855f7',
          borderRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 12,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} ${t('dashboard.minutes')}`
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            maxRotation: 45,
            font: { size: 10 },
            autoSkip: true,
            maxTicksLimit: 10
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: t('dashboard.minutes'),
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// ============ Utility Functions ============
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ Phase 7: Reading Goals ============
async function loadGoalWidget() {
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

function showBooksReadList() {
  const goalEl = document.getElementById('goal-widget');
  const books = goalEl._booksReadList || [];
  if (books.length === 0) {
    showToast('No books finished this year yet');
    return;
  }
  const list = books.map(b => `<div style="padding:2px 0">📖 ${escapeHtml(b.name)} <small style="opacity:.6">${b.finish_date}</small></div>`).join('');
  showToast(`<strong>Books read in ${new Date().getFullYear()}:</strong>${list}`, 'info', 6000);
}

function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.classList.remove('hidden');
  // Load current goal
  const year = new Date().getFullYear();
  API.getGoal(year).then(result => {
    if (result.success && result.goal) {
      document.getElementById('goal-target-books').value = result.goal.targetBooks || '';
      document.getElementById('goal-target-pages').value = result.goal.targetPages || '';
    }
  });
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

async function saveGoal() {
  const targetBooks = document.getElementById('goal-target-books').value;
  const targetPages = document.getElementById('goal-target-pages').value;

  if (!targetBooks && !targetPages) {
    showToast(t('toast.goalEnterTarget'), 'error');
    return;
  }

  try {
    const year = new Date().getFullYear();
    await API.setGoal(year, {
      targetBooks: targetBooks ? parseInt(targetBooks) : null,
      targetPages: targetPages ? parseInt(targetPages) : null,
    });
    showToast(t('toast.goalSaved'), 'success');
    closeSettings();
    loadGoalWidget();
  } catch (e) {
    showToast(t('toast.goalFailed'), 'error');
  }
}

// ============ Immersive Reading Timer ============
let timerInterval = null;
let timerStartTime = null;
let timerPaused = false;
let timerPausedElapsed = 0;
let wakeLockSentinel = null;

const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * 90; // ~565.5

function formatTimerTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getTimerElapsed() {
  if (!timerStartTime) return timerPausedElapsed || 0;
  if (timerPaused) return timerPausedElapsed;
  return (Date.now() - timerStartTime) + timerPausedElapsed;
}

function updateTimerDisplay() {
  const elapsed = getTimerElapsed();
  const timeStr = formatTimerTime(elapsed);

  // Immersive display
  const immersiveEl = document.getElementById('timer-elapsed-immersive');
  if (immersiveEl) immersiveEl.textContent = timeStr;

  // Chip display
  const chipTimeEl = document.getElementById('timer-chip-time');
  if (chipTimeEl) chipTimeEl.textContent = timeStr;

  // SVG ring progress (1 full circle = 60 min)
  const ringEl = document.getElementById('timer-ring-el');
  if (ringEl) {
    const minutesFraction = (elapsed / 60000) % 60;
    const progress = minutesFraction / 60;
    const offset = TIMER_RING_CIRCUMFERENCE * (1 - progress);
    ringEl.style.strokeDasharray = `${TIMER_RING_CIRCUMFERENCE}`;
    ringEl.style.strokeDashoffset = `${offset}`;
  }
}

function showImmersiveTimer() {
  document.getElementById('session-immersive').classList.remove('hidden');
  document.getElementById('session-form-section').classList.add('hidden');
  updateTimerDisplay();
}

function hideImmersiveTimer() {
  document.getElementById('session-immersive').classList.add('hidden');
  document.getElementById('session-form-section').classList.remove('hidden');
}

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
    }
  } catch (e) {
    console.log('Wake Lock not available:', e);
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => { });
    wakeLockSentinel = null;
  }
}

function startReadingTimer() {
  const bookId = document.getElementById('session-book-id').value;
  if (bookId) localStorage.setItem('timerBookId', bookId);

  timerStartTime = Date.now();
  timerPaused = false;
  timerPausedElapsed = 0;
  localStorage.setItem('timerStart', timerStartTime.toString());
  localStorage.setItem('timerPausedElapsed', '0');

  timerInterval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();

  // Show immersive view
  showImmersiveTimer();

  // Show floating chip
  document.getElementById('timer-chip').classList.remove('hidden');

  // Update pause button to show pause icon
  const pauseBtn = document.getElementById('timer-pause-btn');
  pauseBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  pauseBtn.title = 'Pause';

  acquireWakeLock();
}

function pauseReadingTimer() {
  if (!timerStartTime && !timerPaused) return;

  const pauseBtn = document.getElementById('timer-pause-btn');

  if (timerPaused) {
    // Resume
    timerPaused = false;
    timerStartTime = Date.now();
    localStorage.setItem('timerStart', timerStartTime.toString());
    timerInterval = setInterval(updateTimerDisplay, 1000);
    pauseBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
    pauseBtn.title = 'Pause';
    document.querySelector('.timer-sub').textContent = t('session.reading');
    document.querySelector('.timer-ring-container')?.classList.remove('timer-paused');
    acquireWakeLock();
  } else {
    // Pause
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerPausedElapsed += Date.now() - timerStartTime;
    timerPaused = true;
    timerStartTime = null;
    localStorage.removeItem('timerStart');
    localStorage.setItem('timerPausedElapsed', timerPausedElapsed.toString());
    pauseBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
    pauseBtn.title = 'Resume';
    document.querySelector('.timer-sub').textContent = t('session.paused');
    document.querySelector('.timer-ring-container')?.classList.add('timer-paused');
    releaseWakeLock();
  }
}

function stopReadingTimer() {
  const elapsed = getTimerElapsed();
  const minutes = Math.round(elapsed / 60000);

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerStartTime = null;
  timerPaused = false;
  timerPausedElapsed = 0;
  localStorage.removeItem('timerStart');
  localStorage.removeItem('timerBookId');
  localStorage.removeItem('timerPausedElapsed');

  document.getElementById('timer-chip').classList.add('hidden');
  releaseWakeLock();

  // Auto-fill duration and show form
  if (minutes > 0) {
    document.getElementById('session-duration').value = minutes;
  }

  // Hide start button since we just stopped a timer
  document.getElementById('timer-start-btn').style.display = 'none';
  hideImmersiveTimer();
}

function restoreTimer() {
  const savedStart = localStorage.getItem('timerStart');
  const savedPaused = localStorage.getItem('timerPausedElapsed');

  if (savedStart) {
    timerStartTime = parseInt(savedStart);
    timerPausedElapsed = savedPaused ? parseInt(savedPaused) : 0;
    timerPaused = false;
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
    document.getElementById('timer-chip').classList.remove('hidden');
    acquireWakeLock();
  } else if (savedPaused && parseInt(savedPaused) > 0) {
    // Timer was paused
    timerPausedElapsed = parseInt(savedPaused);
    timerPaused = true;
    timerStartTime = null;
    updateTimerDisplay();
    document.getElementById('timer-chip').classList.remove('hidden');
  }
}

// ============ Phase 7: Series ============
let availableSeries = [];

async function loadSeriesList() {
  try {
    const result = await API.getSeries();
    if (result.success) {
      availableSeries = result.series || [];
    }
  } catch (e) {
    console.error('Failed to load series:', e);
  }
}

function populateSeriesDropdown(selectedId = null) {
  const select = document.getElementById('book-series');
  select.innerHTML = '<option value="">' + t('book.noSeries') + '</option>';
  availableSeries.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name + (s.totalBooks ? ` (${s.bookCount}/${s.totalBooks})` : '');
    if (selectedId && s.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

async function createNewSeries() {
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
  } catch (e) {
    showToast(t('toast.seriesFailed'), 'error');
  }
}

// ============ Phase 7: Backup / Restore ============
async function exportData() {
  try {
    const result = await API.exportData();
    if (result.success) {
      const json = JSON.stringify(result.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bokbad-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('toast.dataExported'), 'success');
    }
  } catch (e) {
    showToast(t('toast.exportFailed'), 'error');
  }
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('import-status');
  statusEl.classList.remove('hidden');
  statusEl.textContent = t('import.readingFile');

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const bookCount = data.books?.length || 0;
    const sessionCount = data.sessions?.length || 0;
    statusEl.textContent = t('import.foundData', { books: bookCount, sessions: sessionCount });

    const result = await API.importData(data);
    if (result.success) {
      const imp = result.imported;
      statusEl.textContent = t('import.imported', { books: imp.books, sessions: imp.sessions, goals: imp.goals, series: imp.series });
      showToast(t('toast.importSuccess'), 'success');
      // Reload everything
      await BookManager.loadBooks();
      await BookManager.loadTags();
      const activeView = document.querySelector('.view.active');
      if (activeView?.id === 'home-view') renderHome();
      else if (activeView?.id === 'library-view') renderBooks();
    } else {
      statusEl.textContent = t('toast.importFailed');
    }
  } catch (err) {
    statusEl.textContent = t('toast.importInvalid');
    console.error('Import error:', err);
  }

  // Reset file input
  e.target.value = '';
}

// Initialize on load
init();



// ============ Change Own Password ============
async function handleChangePassword() {
  const statusEl = document.getElementById('password-status');
  statusEl.textContent = '';
  statusEl.className = 'error-message';

  const currentPw = document.getElementById('current-password').value;
  const newPw = document.getElementById('new-password').value;
  const confirmPw = document.getElementById('confirm-password').value;

  if (!currentPw || !newPw) {
    statusEl.textContent = t('toast.fillAllFields');
    return;
  }
  if (newPw.length < 4) {
    statusEl.textContent = t('toast.newPasswordMinLength');
    return;
  }
  if (newPw !== confirmPw) {
    statusEl.textContent = t('toast.newPasswordsNoMatch');
    return;
  }

  try {
    const result = await API.changePassword(currentPw, newPw);
    if (result.success || result.changed) {
      statusEl.className = 'success-message';
      statusEl.textContent = t('toast.passwordChangedSuccess');
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      // Clear forced password change flag
      if (Auth.currentUser) {
        Auth.currentUser.must_change_password = false;
      }
      showToast(t('toast.passwordChanged'), 'success');
    } else {
      statusEl.textContent = result.error || t('toast.operationFailed');
    }
  } catch (err) {
    statusEl.textContent = t('toast.networkError');
  }
}
