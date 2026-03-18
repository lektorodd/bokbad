import { t } from '../i18n.js';
import { showToast } from './toast.js';

let activeScanner = null;

/**
 * Open the ISBN barcode scanner
 * @param {Function} onScanned - Callback with scanned ISBN, called after closing scanner
 */
export async function openScanner(onScanned) {
  const overlay = document.getElementById('scanner-overlay');
  overlay.classList.remove('hidden');

  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    activeScanner = new Html5Qrcode('scanner-viewfinder');
    await activeScanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // All barcode formats
      },
      (decodedText) => {
        // Only accept ISBN-like codes (10 or 13 digits)
        const cleaned = decodedText.replace(/[-\s]/g, '');
        if (/^\d{10}(\d{3})?$/.test(cleaned)) {
          document.getElementById('book-isbn').value = cleaned;
          closeScanner();
          showToast(t('toast.isbnScanned', { isbn: cleaned }), 'success');
          // Trigger callback (e.g. metadata fetch)
          if (onScanned) onScanned(cleaned);
        }
      },
      () => {} // Ignore failures (continuous scanning)
    );
  } catch (error) {
    console.error('Scanner error:', error);
    showToast(t('toast.cameraFailed'), 'error');
    closeScanner();
  }
}

/**
 * Close the barcode scanner and clean up
 */
export async function closeScanner() {
  const overlay = document.getElementById('scanner-overlay');
  overlay.classList.add('hidden');

  if (activeScanner) {
    try {
      await activeScanner.stop();
    } catch {
      /* scanner may already be stopped */
    }
    activeScanner = null;
  }
  // Clear the viewfinder HTML left by the library
  document.getElementById('scanner-viewfinder').innerHTML = '';
}
