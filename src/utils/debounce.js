/**
 * Creates a debounced version of a function that delays invocation
 * until after `wait` milliseconds have elapsed since the last call.
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to delay
 * @returns {Function}
 */
export function debounce(func, wait) {
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
