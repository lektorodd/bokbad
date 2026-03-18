import { t } from '../i18n.js';
import BookManager from '../bookManager.js';
import { showToast } from './toast.js';

let isProcessingSwipe = false;

/**
 * Attach swipe gesture handlers to a book card container
 * @param {HTMLElement} container
 * @param {Object} callbacks
 * @param {Function} callbacks.renderBooks
 * @param {Function} callbacks.renderHome
 * @param {Function} callbacks.updateFilterTabCounts
 * @param {Function} callbacks.openSessionModal
 */
export function attachSwipeHandlers(
  container,
  { renderBooks, renderHome, updateFilterTabCounts, openSessionModal }
) {
  let startX = 0;
  let startY = 0;
  let currentCard = null;
  let swiping = false;
  const THRESHOLD = 70;

  container.addEventListener(
    'touchstart',
    (e) => {
      if (isProcessingSwipe) return;
      // Skip swipe in grid view — only taps
      if (container.classList.contains('grid-view')) return;
      const card = e.target.closest('.book-card');
      if (!card) return;

      // Reset any previously swiped cards
      container.querySelectorAll('.book-card.swiped-left, .book-card.swiped-right').forEach((c) => {
        if (c !== card) resetSwipe(c);
      });

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentCard = card;
      swiping = false;
    },
    { passive: true }
  );

  container.addEventListener(
    'touchmove',
    (e) => {
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
    },
    { passive: false }
  );

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
        const nextLabel = {
          'want-to-read': t('status.wantToRead'),
          'up-next': t('status.upNext'),
          reading: t('status.reading'),
          read: t('status.read'),
        }[nextStatus];
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

/**
 * Reset swipe visual state on a card
 * @param {HTMLElement} card
 */
export function resetSwipe(card) {
  const cardInner = card.querySelector('.book-card-inner') || card;
  cardInner.style.transition = 'transform 0.25s ease';
  cardInner.style.transform = 'translateX(0)';
  const leftAction = card.querySelector('.swipe-action-left');
  const rightAction = card.querySelector('.swipe-action-right');
  if (leftAction) leftAction.style.opacity = '0';
  if (rightAction) rightAction.style.opacity = '0';
}
