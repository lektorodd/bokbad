// @ts-check
import './style.css';
import Auth from './auth.js';
import BookManager from './bookManager.js';
import API from './api.js';
import { t, getLocale, setLocale, initI18n } from './i18n.js';
import { escapeHtml } from './utils/escapeHtml.js';
import { debounce } from './utils/debounce.js';

// ============ Component imports ============
import { showToast } from './components/toast.js';
import { initDarkMode, toggleDarkMode } from './components/darkMode.js';
import { setupPullToRefresh } from './components/pullToRefresh.js';
import { attachSwipeHandlers } from './components/swipe.js';
import { setupAdminEventListeners } from './components/admin.js';
import { loadSeriesList } from './components/series.js';

// ============ View imports ============
import { renderHome, showBookPicker, showBooksReadList, loadGoalWidget } from './views/home.js';
import {
  renderBooks,
  populateFilterDropdowns,
  renderActiveFilterPills,
  updateFilterTabCounts,
  setBookView,
  loadViewPreference,
} from './views/library.js';
import {
  loadDashboard,
  loadYearlyStats,
  setCurrentPeriod,
} from './views/dashboard.js';

// ============ Modal imports ============
import { openActivityCalendar } from './modals/calendarModal.js';
import {
  openDetailModal,
  closeDetailModal,
  navigateToLibraryWithFilter,
} from './modals/detailModal.js';
import {
  openSessionModal,
  closeSessionModal,
  handleSessionSubmit,
  startReadingTimer,
  pauseReadingTimer,
  stopReadingTimer,
  showImmersiveTimer,
  restoreTimer,
} from './modals/sessionModal.js';
import {
  openBookModal,
  closeBookModal,
  handleBookSubmit,
  handleBookDelete,
  setupBookModalListeners,
} from './modals/bookModal.js';
import {
  openSettings,
  closeSettings,
  saveGoal,
  exportData,
  importData,
  handleChangePassword,
} from './modals/settingsModal.js';

// ============ Callback factories ============
// These create the callback objects that modules need to call back into each other.
// This avoids circular imports by passing functions at runtime.

function homeCallbacks() {
  return {
    openDetailModal: (bookId) => openDetailModal(bookId, detailCallbacks()),
    openSessionModal: (bookId) => openSessionModal(bookId, { renderHome: () => renderHome(homeCallbacks()) }),
    renderBooks: () => renderBooks(libraryCallbacks()),
    updateFilterTabCounts,
    openActivityCalendar,
    openSettings,
  };
}

function libraryCallbacks() {
  return {
    openDetailModal: (bookId) => openDetailModal(bookId, detailCallbacks()),
    attachSwipeHandlers: (container) =>
      attachSwipeHandlers(container, {
        renderBooks: () => renderBooks(libraryCallbacks()),
        renderHome: () => renderHome(homeCallbacks()),
        updateFilterTabCounts,
        openSessionModal: (bookId) =>
          openSessionModal(bookId, { renderHome: () => renderHome(homeCallbacks()) }),
      }),
    renderBooks: () => renderBooks(libraryCallbacks()),
  };
}

function detailCallbacks() {
  return {
    navigateToLibraryWithFilter: (filters) =>
      navigateToLibraryWithFilter(filters, {
        switchView,
        renderActiveFilterPills: () => renderActiveFilterPills(filterPillCallbacks()),
      }),
    openBookModal: (bookId) => openBookModal(bookId),
    openSessionModal: (bookId) => openSessionModal(bookId, { renderHome: () => renderHome(homeCallbacks()) }),
  };
}

function filterPillCallbacks() {
  return {
    renderBooks: () => renderBooks(libraryCallbacks()),
  };
}

function bookModalCallbacks() {
  return {
    renderHome: () => renderHome(homeCallbacks()),
    renderBooks: () => renderBooks(libraryCallbacks()),
    populateFilterDropdowns,
    updateFilterTabCounts,
  };
}

function settingsCallbacks() {
  return {
    loadGoalWidget: () => loadGoalWidget(homeCallbacks()),
    renderHome: () => renderHome(homeCallbacks()),
    renderBooks: () => renderBooks(libraryCallbacks()),
  };
}

// ============ Navigation ============
function switchView(viewName) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  // Update views
  document.querySelectorAll('.app-main > .view').forEach((view) => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.add('active');

    if (viewName === 'home') {
      renderHome(homeCallbacks());
    } else if (viewName === 'library') {
      renderBooks(libraryCallbacks());
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

// ============ Announcement Banner ============
async function fetchAnnouncements() {
  try {
    const username = Auth.currentUser?.username;
    const url = `https://admin.lektorodd.no/api/announcements/public.php?app=bokbad${username ? '&username=' + encodeURIComponent(username) : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.announcements || !data.announcements.length) return;

    const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
    const active = data.announcements.filter((a) => !dismissed.includes(a.id));
    if (!active.length) return;

    const old = document.querySelector('.announcement-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.className = 'announcement-banner';
    const a = active[0];
    // Lightweight markdown: **bold** and [text](url)
    const md = (s) => {
      let txt = escapeHtml(s || '');
      txt = txt.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      txt = txt.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" style="color:inherit;text-decoration:underline;">$1</a>'
      );
      return txt;
    };
    banner.innerHTML = `
      <span class="announcement-banner-text"><strong>${a.icon || '📢'} ${escapeHtml(a.title)}</strong> — ${md(a.message)}</span>
      <button class="announcement-banner-close" aria-label="Lukk">✕</button>
    `;
    banner.querySelector('.announcement-banner-close').addEventListener('click', () => {
      dismissed.push(a.id);
      localStorage.setItem('dismissed_announcements', JSON.stringify(dismissed));
      banner.remove();
      // Report dismissal to admin
      const uname = Auth.currentUser?.username;
      if (uname) {
        fetch('https://admin.lektorodd.no/api/announcements/public.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcement_id: a.id, username: uname, app: 'bokbad' }),
        }).catch(() => {});
      }
    });

    const header = document.querySelector('.app-header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      const app = document.getElementById('app');
      app.insertBefore(banner, app.firstChild);
    }
  } catch (_e) {
    /* silent */
  }
}

// ============ Auth Views ============
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
  fetchAnnouncements();
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

// ============ Data Loading ============
async function loadBooks() {
  await BookManager.loadBooks();
  renderHome(homeCallbacks());
  updateFilterTabCounts();
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
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
    });
  });

  // Add book button
  document.getElementById('add-book-btn').addEventListener('click', () => {
    openBookModal();
  });

  // Pull-to-refresh
  setupPullToRefresh({
    renderHome: () => renderHome(homeCallbacks()),
    renderBooks: () => renderBooks(libraryCallbacks()),
    loadDashboard,
  });

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
    modal.addEventListener(
      'animationend',
      () => {
        modal.classList.add('hidden');
        modal.classList.remove('modal-closing');
      },
      { once: true }
    );
  });

  // Streak stat in dashboard → open calendar
  document
    .getElementById('stat-streak')
    ?.closest('.stat-metric')
    ?.addEventListener('click', () => openActivityCalendar());

  // Detail modal: Log Reading
  document.getElementById('detail-log-btn').addEventListener('click', () => {
    const bookId = document.getElementById('detail-modal').dataset.bookId;
    if (bookId) {
      closeDetailModal();
      openSessionModal(parseInt(bookId), { renderHome: () => renderHome(homeCallbacks()) });
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
  document.getElementById('book-form').addEventListener('submit', (e) => {
    handleBookSubmit(e, bookModalCallbacks());
  });

  // Delete book
  document.getElementById('delete-book-btn').addEventListener('click', () => {
    handleBookDelete(bookModalCallbacks());
  });

  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener(
    'input',
    debounce((e) => {
      BookManager.setSearch(e.target.value);
      renderBooks(libraryCallbacks());
      renderActiveFilterPills(filterPillCallbacks());
    }, 300)
  );

  // Filter tabs (multi-select)
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const status = tab.dataset.status;
      if (status === 'all') {
        document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        BookManager.setFilter([]);
      } else {
        document.querySelector('.filter-tab[data-status="all"]').classList.remove('active');
        tab.classList.toggle('active');
        const activeStatuses = [];
        document.querySelectorAll('.filter-tab.active').forEach((t) => {
          if (t.dataset.status !== 'all') activeStatuses.push(t.dataset.status);
        });
        if (activeStatuses.length === 0) {
          document.querySelector('.filter-tab[data-status="all"]').classList.add('active');
        }
        BookManager.setFilter(activeStatuses);
        if (activeStatuses.length === 1 && activeStatuses[0] === 'reading') {
          BookManager.setSort('progress');
          document.getElementById('sort-select').value = 'progress';
        }
      }
      renderBooks(libraryCallbacks());
      renderActiveFilterPills(filterPillCallbacks());
    });
  });

  // Genre/Topic/Audiobook filters
  document.getElementById('genre-filter').addEventListener('change', (e) => {
    BookManager.setGenreFilter(e.target.value);
    renderBooks(libraryCallbacks());
    renderActiveFilterPills(filterPillCallbacks());
  });
  document.getElementById('topic-filter').addEventListener('change', (e) => {
    BookManager.setTopicFilter(e.target.value);
    renderBooks(libraryCallbacks());
    renderActiveFilterPills(filterPillCallbacks());
  });
  document.getElementById('audiobook-filter').addEventListener('change', (e) => {
    BookManager.setAudiobookFilter(e.target.value);
    renderBooks(libraryCallbacks());
    renderActiveFilterPills(filterPillCallbacks());
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    BookManager.setSort(e.target.value);
    renderBooks(libraryCallbacks());
    renderActiveFilterPills(filterPillCallbacks());
  });

  // Extra filters toggle
  document.getElementById('toggle-extra-filters').addEventListener('click', () => {
    const panel = document.getElementById('extra-filters');
    const btn = document.getElementById('toggle-extra-filters');
    panel.classList.toggle('hidden');
    btn.classList.toggle('active');
  });

  // Book modal sub-listeners (cover, ISBN, format, series, autocomplete)
  setupBookModalListeners(bookModalCallbacks());

  // Settings modal
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('save-goal-btn').addEventListener('click', () => saveGoal(settingsCallbacks()));
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document
    .getElementById('import-data-btn')
    .addEventListener('click', () => document.getElementById('import-data-file').click());
  document.getElementById('import-data-file').addEventListener('change', (e) => importData(e, settingsCallbacks()));

  // Immersive timer controls
  document.getElementById('timer-start-btn').addEventListener('click', startReadingTimer);
  document.getElementById('timer-pause-btn').addEventListener('click', pauseReadingTimer);
  document.getElementById('timer-stop-btn').addEventListener('click', stopReadingTimer);
  document.getElementById('session-immersive-close').addEventListener('click', closeSessionModal);
  document.getElementById('timer-chip').addEventListener('click', () => {
    const bookId = localStorage.getItem('timerBookId');
    if (bookId) {
      openSessionModal(parseInt(bookId), { renderHome: () => renderHome(homeCallbacks()) });
      showImmersiveTimer();
    }
  });

  // Goal widget: tap = show books list, long-press = settings
  const goalWidget = document.getElementById('goal-widget');
  let goalPressTimer = null;
  goalWidget.addEventListener('pointerdown', () => {
    goalPressTimer = setTimeout(() => {
      goalPressTimer = 'long';
      openSettings();
    }, 500);
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
  document.getElementById('home-log-reading-btn').addEventListener('click', () => {
    const reading = BookManager.getBooksByStatus('reading');
    const otherBooks = BookManager.books.filter(
      (b) => b.status !== 'read' && b.status !== 'reading'
    );
    if (reading.length === 1 && otherBooks.length === 0) {
      openSessionModal(reading[0].id, { renderHome: () => renderHome(homeCallbacks()) });
    } else {
      showBookPicker(reading, otherBooks, {
        renderHome: () => renderHome(homeCallbacks()),
        renderBooks: () => renderBooks(libraryCallbacks()),
        updateFilterTabCounts,
        openSessionModal: (bookId) =>
          openSessionModal(bookId, { renderHome: () => renderHome(homeCallbacks()) }),
      });
    }
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
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setCurrentPeriod(btn.dataset.period);
      loadDashboard();
    });
  });

  // View toggle
  document.getElementById('view-compact').addEventListener('click', () => setBookView('compact'));
  document.getElementById('view-expanded').addEventListener('click', () => setBookView('expanded'));
  document.getElementById('view-grid').addEventListener('click', () => setBookView('grid'));

  // Session modal
  document.getElementById('session-close-btn').addEventListener('click', closeSessionModal);
  document.getElementById('session-cancel-btn').addEventListener('click', closeSessionModal);
  document.getElementById('session-modal').addEventListener('click', (e) => {
    if (e.target.id === 'session-modal') closeSessionModal();
  });
  document.getElementById('session-form').addEventListener('submit', (e) => {
    handleSessionSubmit(e, { renderHome: () => renderHome(homeCallbacks()) });
  });

  // Change password
  document.getElementById('change-password-btn')?.addEventListener('click', () => {
    handleChangePassword({ Auth });
  });

  // Admin panel event listeners
  if (Auth.isAdmin()) {
    setupAdminEventListeners();
  }

  // Feedback modal (from header menu)
  document.getElementById('report-issue-menu-btn').addEventListener('click', () => {
    document.getElementById('header-menu-dropdown').classList.add('hidden');
    const form = document.getElementById('feedback-form');
    form.reset();
    document.getElementById('feedback-form-error').textContent = '';
    document.getElementById('feedback-char-count').textContent = '0 / 2000';
    document.getElementById('feedback-modal').classList.remove('hidden');
  });

  document.getElementById('feedback-close-btn').addEventListener('click', () => {
    document.getElementById('feedback-modal').classList.add('hidden');
  });
  document.getElementById('feedback-cancel-btn').addEventListener('click', () => {
    document.getElementById('feedback-modal').classList.add('hidden');
  });
  document.getElementById('feedback-modal').addEventListener('click', (e) => {
    if (e.target.id === 'feedback-modal')
      document.getElementById('feedback-modal').classList.add('hidden');
  });

  document.getElementById('feedback-message').addEventListener('input', (e) => {
    document.getElementById('feedback-char-count').textContent = `${e.target.value.length} / 2000`;
  });

  document.getElementById('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('feedback-form-error');
    errEl.textContent = '';
    const message = document.getElementById('feedback-message').value.trim();
    if (message.length < 3) {
      errEl.textContent = t('settings.feedbackMinLength');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '...';

    try {
      const res = await API.submitFeedback(message);
      if (!res.success) throw new Error(res.error || 'Failed');
      document.getElementById('feedback-modal').classList.add('hidden');
      showToast(t('settings.feedbackSent'), 'success');
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });

  // Settings inline feedback form
  document.getElementById('settings-feedback-message')?.addEventListener('input', (e) => {
    document.getElementById('settings-feedback-char-count').textContent =
      `${e.target.value.length} / 2000`;
  });

  document.getElementById('settings-feedback-submit')?.addEventListener('click', async () => {
    const errEl = document.getElementById('settings-feedback-error');
    errEl.textContent = '';
    const textarea = document.getElementById('settings-feedback-message');
    const message = textarea.value.trim();
    if (message.length < 3) {
      errEl.textContent = t('settings.feedbackMinLength');
      return;
    }

    const btn = document.getElementById('settings-feedback-submit');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const res = await API.submitFeedback(message);
      if (!res.success) throw new Error(res.error || 'Failed');
      textarea.value = '';
      document.getElementById('settings-feedback-char-count').textContent = '0 / 2000';
      showToast(t('settings.feedbackSent'), 'success');
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

// ============ Error Recovery ============
function showErrorScreen(error) {
  // Hide app and login views
  document.getElementById('login-view')?.classList.add('hidden');
  document.getElementById('app')?.classList.add('hidden');
  // Show error screen
  const screen = document.getElementById('error-screen');
  const details = document.getElementById('error-details-text');
  if (screen) screen.classList.remove('hidden');
  if (details) details.textContent = error?.stack || error?.message || String(error);
  console.error('Fatal init error:', error);
}

// ============ Initialize ============
async function init() {
  initDarkMode();
  await initI18n();

  // Show version in dropdown
  const versionEl = document.getElementById('app-version-label');
  if (versionEl) versionEl.textContent = `v${__APP_VERSION__}`;

  // Wire language selector
  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = getLocale();
    langSelect.addEventListener('change', async (e) => {
      await setLocale(e.target.value);
      // Re-render active view
      const activeView = document.querySelector('.view.active');
      if (activeView?.id === 'home-view') renderHome(homeCallbacks());
      else if (activeView?.id === 'library-view') {
        updateFilterTabCounts();
        renderBooks(libraryCallbacks());
      } else if (activeView?.id === 'dashboard-view') loadDashboard();
    });
  }

  // Listen for session expiration (401 from any API call)
  window.addEventListener(
    'session-expired',
    () => {
      showToast(t('toast.sessionExpired'), 'error');
      showLogin();
      setupLoginListeners();
    },
    { once: true }
  );

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

// Keep modals above the virtual keyboard on mobile
if (window.visualViewport) {
  const updateKeyboardHeight = () => {
    const kbHeight =
      window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
    document.documentElement.style.setProperty('--keyboard-height', Math.max(0, kbHeight) + 'px');
  };
  window.visualViewport.addEventListener('resize', updateKeyboardHeight);
  window.visualViewport.addEventListener('scroll', updateKeyboardHeight);
}

// Global error boundaries
window.addEventListener('error', (e) => {
  // Only show error screen if the app hasn't rendered yet
  const app = document.getElementById('app');
  if (app?.classList.contains('hidden')) {
    showErrorScreen(e.error || e.message);
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const app = document.getElementById('app');
  if (app?.classList.contains('hidden')) {
    showErrorScreen(e.reason);
  }
});

// Initialize on load
init().catch(showErrorScreen);
