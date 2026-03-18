/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Toast type
 * @param {number} [duration=3000] - Auto-dismiss duration in ms
 * @param {Object} [options={}]
 * @param {boolean} [options.allowHtml=false] - If true, render message as HTML
 */
export function showToast(message, type = 'info', duration = 3000, options = {}) {
  const { allowHtml = false } = options;
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  if (allowHtml) {
    toast.innerHTML = message;
  } else {
    toast.textContent = message;
  }
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}
