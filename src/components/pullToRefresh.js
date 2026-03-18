import { t } from '../i18n.js';
import BookManager from '../bookManager.js';

/**
 * Set up pull-to-refresh on the main scrollable area
 * @param {Object} callbacks - View render callbacks
 * @param {Function} callbacks.renderHome
 * @param {Function} callbacks.renderBooks
 * @param {Function} callbacks.loadDashboard
 */
export function setupPullToRefresh({ renderHome, renderBooks, loadDashboard }) {
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
      pullIndicator.innerHTML =
        '<span class="pull-spinner">↻</span><span class="pull-text">' +
        t('pull.pullToRefresh') +
        '</span>';
      main.prepend(pullIndicator);
    }
    return pullIndicator;
  }

  main.addEventListener(
    'touchstart',
    (e) => {
      // Only allow pull if already resting at top (not scrolling up to top)
      atTop = main.scrollTop <= 0;
      cancelled = false;
      if (atTop) {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        pulling = false;
      }
    },
    { passive: true }
  );

  main.addEventListener(
    'touchmove',
    (e) => {
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
    },
    { passive: true }
  );

  main.addEventListener('touchend', async () => {
    if (!pulling || cancelled) {
      atTop = false;
      pulling = false;
      cancelled = false;
      if (pullIndicator) {
        pullIndicator.style.height = '0px';
        pullIndicator.style.opacity = '0';
        setTimeout(() => {
          pullIndicator?.remove();
          pullIndicator = null;
        }, 200);
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
      } catch (_err) {
        if (indicator) {
          indicator.querySelector('.pull-text').textContent = t('pull.refreshFailed');
        }
      }
    }
    if (indicator) {
      setTimeout(() => {
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
        setTimeout(() => {
          indicator.remove();
          pullIndicator = null;
        }, 300);
      }, 600);
    }
  });
}
