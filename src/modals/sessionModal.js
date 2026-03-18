import API from '../api.js';
import BookManager from '../bookManager.js';
import { t } from '../i18n.js';
import { showToast } from '../components/toast.js';
import { sanitizeImageUrl } from '../utils/escapeHtml.js';
import { formatDuration } from '../utils/format.js';

// ============ Immersive Reading Timer State ============
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
  return Date.now() - timerStartTime + timerPausedElapsed;
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

export function showImmersiveTimer() {
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
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

export function startReadingTimer() {
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
  pauseBtn.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  pauseBtn.title = 'Pause';

  acquireWakeLock();
}

export function pauseReadingTimer() {
  if (!timerStartTime && !timerPaused) return;

  const pauseBtn = document.getElementById('timer-pause-btn');

  if (timerPaused) {
    // Resume
    timerPaused = false;
    timerStartTime = Date.now();
    localStorage.setItem('timerStart', timerStartTime.toString());
    timerInterval = setInterval(updateTimerDisplay, 1000);
    pauseBtn.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
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
    pauseBtn.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
    pauseBtn.title = 'Resume';
    document.querySelector('.timer-sub').textContent = t('session.paused');
    document.querySelector('.timer-ring-container')?.classList.add('timer-paused');
    releaseWakeLock();
  }
}

export function stopReadingTimer() {
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

export function restoreTimer() {
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

/**
 * Open the session modal for a book
 * @param {number} bookId
 * @param {Object} [callbacks]
 * @param {Function} [callbacks.renderHome]
 */
export function openSessionModal(bookId, callbacks) {
  const book = BookManager.getBook(bookId);
  if (!book) return;

  // Store callbacks on the modal for use in submit
  const modal = document.getElementById('session-modal');
  modal._callbacks = callbacks;
  const form = document.getElementById('session-form');
  form.reset();

  document.getElementById('session-book-id').value = bookId;
  document.getElementById('session-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('session-error').textContent = '';

  // Populate cover art
  const coverUrl = sanitizeImageUrl(book.cover_image);
  const bgEl = document.getElementById('session-bg-cover');
  bgEl.style.backgroundImage = coverUrl ? `url("${coverUrl}")` : 'none';

  const coverImg = document.getElementById('session-book-cover-img');
  if (coverUrl) {
    coverImg.src = coverUrl;
    coverImg.alt = book.name || '';
    coverImg.style.display = '';
  } else {
    coverImg.style.display = 'none';
  }

  // Form book header
  document.getElementById('session-book-name').textContent = book.name;
  const format = book.format || 'paper';
  let progressInfo = '';
  if (format === 'paper' && book.total_pages) {
    progressInfo = t('session.pagesProgress', {
      current: book.current_page || 0,
      total: book.total_pages,
    });
  } else if (format === 'audiobook' && book.total_duration_min) {
    progressInfo = `${formatDuration(book.current_duration_min || 0)} / ${formatDuration(book.total_duration_min)}`;
  } else if (format === 'ebook') {
    progressInfo = t('session.percentProgress', { percent: book.current_percentage || 0 });
  }
  document.getElementById('session-book-pages').textContent = progressInfo;

  // Immersive timer info
  document.getElementById('session-timer-title').textContent = book.name;
  const authors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors || '';
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
    positionHint.textContent =
      t('session.timeCurrently', { time: formatDuration(currentMin) }) +
      (book.total_duration_min ? ` / ${totalDur}` : '');
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
    document.getElementById('timer-start-btn').style.display =
      format === 'audiobook' ? 'none' : '';
  }

  modal.classList.remove('hidden');
}

export function closeSessionModal() {
  const modal = document.getElementById('session-modal');
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
 * Handle session form submission
 * @param {Event} e
 * @param {Object} callbacks
 * @param {Function} callbacks.renderHome
 */
export async function handleSessionSubmit(e, callbacks) {
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
    notes: notes || undefined,
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
        if (result.current_duration_min !== undefined)
          book.current_duration_min = result.current_duration_min;
        if (result.current_percentage !== undefined)
          book.current_percentage = result.current_percentage;
      }

      // Append session notes to book's Notes & Highlights
      if (notes && book) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
        const header = `## Reading session ${dateStr} - ${timeStr}`;
        const newEntry = `${header}\n${notes}`;
        const updatedThoughts = book.thoughts ? `${book.thoughts}\n\n${newEntry}` : newEntry;
        await BookManager.updateBook({ id: bookId, thoughts: updatedThoughts });
      }

      closeSessionModal();
      showToast(t('toast.sessionLogged'), 'success');
      if (callbacks?.renderHome) callbacks.renderHome();
    } else {
      document.getElementById('session-error').textContent =
        result.error || t('toast.sessionFailed');
    }
  } catch {
    showToast(t('toast.sessionFailed'), 'error');
  }
}
