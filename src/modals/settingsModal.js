import API from '../api.js';
import BookManager from '../bookManager.js';
import { t } from '../i18n.js';
import { showToast } from '../components/toast.js';


/**
 * Open the settings modal
 */
export function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.classList.remove('hidden');
  // Load current goal
  const year = new Date().getFullYear();
  API.getGoal(year).then((result) => {
    if (result.success && result.goal) {
      document.getElementById('goal-target-books').value = result.goal.targetBooks || '';
      document.getElementById('goal-target-pages').value = result.goal.targetPages || '';
    }
  });
}

/**
 * Close the settings modal
 */
export function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

/**
 * Save reading goal
 * @param {Object} callbacks
 * @param {Function} callbacks.loadGoalWidget
 */
export async function saveGoal(callbacks) {
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
    if (callbacks?.loadGoalWidget) callbacks.loadGoalWidget();
  } catch (_e) {
    showToast(t('toast.goalFailed'), 'error');
  }
}

/**
 * Export all data as JSON
 */
export async function exportData() {
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
  } catch (_e) {
    showToast(t('toast.exportFailed'), 'error');
  }
}

/**
 * Import data from a JSON file
 * @param {Event} e
 * @param {Object} callbacks
 * @param {Function} callbacks.renderHome
 * @param {Function} callbacks.renderBooks
 */
export async function importData(e, callbacks) {
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
      statusEl.textContent = t('import.imported', {
        books: imp.books,
        sessions: imp.sessions,
        goals: imp.goals,
        series: imp.series,
      });
      showToast(t('toast.importSuccess'), 'success');
      // Reload everything
      await BookManager.loadBooks();
      await BookManager.loadTags();
      const activeView = document.querySelector('.view.active');
      if (activeView?.id === 'home-view' && callbacks?.renderHome) callbacks.renderHome();
      else if (activeView?.id === 'library-view' && callbacks?.renderBooks) callbacks.renderBooks();
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

/**
 * Handle password change
 * @param {Object} deps
 * @param {Object} deps.Auth
 */
export async function handleChangePassword(deps) {
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
      if (deps.Auth.currentUser) {
        deps.Auth.currentUser.must_change_password = false;
      }
      showToast(t('toast.passwordChanged'), 'success');
    } else {
      statusEl.textContent = result.error || t('toast.operationFailed');
    }
  } catch (_err) {
    statusEl.textContent = t('toast.networkError');
  }
}
