// @ts-check
import API from './api.js';

/**
 * @typedef {Object} Book
 * @property {number} id
 * @property {string} name
 * @property {string[]} [authors]
 * @property {string[]} [genres]
 * @property {string[]} [topics]
 * @property {string} status - 'want-to-read' | 'up-next' | 'reading' | 'read'
 * @property {'paper'|'ebook'|'audiobook'} [format]
 * @property {number} [total_pages]
 * @property {number} [current_page]
 * @property {number} [current_percentage]
 * @property {number} [total_duration_min]
 * @property {number} [current_duration_min]
 * @property {string} [cover_url]
 * @property {string} [isbn]
 * @property {number} [series_id]
 * @property {string} [series_name]
 * @property {number} [series_order]
 * @property {string} [finish_date]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} BookResult
 * @property {boolean} success
 * @property {Book} [book]
 * @property {string} [error]
 */

class BookManager {
  /** @type {Book[]} */
  static books = [];
  /** @type {string[]} */
  static currentFilter = []; // empty = all
  static currentSearch = '';
  /** @type {'all'|'audiobook'|'paper'|'ebook'} */
  static currentAudiobookFilter = 'all';
  static currentGenreFilter = '';
  static currentTopicFilter = '';
  static currentAuthorFilter = '';
  /** @type {number|null} */
  static currentSeriesFilter = null;
  static currentSort = 'newest';
  /** @type {string[]} */
  static availableGenres = [];
  /** @type {string[]} */
  static availableTopics = [];
  /** @type {string[]} */
  static availableAuthors = [];

  /**
   * Load books from the API
   * @param {Object} [filters={}]
   * @returns {Promise<Book[]>}
   */
  static async loadBooks(filters = {}) {
    try {
      const result = await API.getBooks(filters);
      if (result.success) {
        this.books = result.books;
        return this.books;
      }
      return [];
    } catch (error) {
      console.error('Failed to load books:', error);
      return [];
    }
  }

  /**
   * Load available tags for autocomplete
   * @returns {Promise<{genres: string[], topics: string[], authors: string[]}>}
   */
  static async loadTags() {
    try {
      const result = await API.getTags();
      if (result.success) {
        this.availableGenres = result.genres || [];
        this.availableTopics = result.topics || [];
        this.availableAuthors = result.authors || [];
        return {
          genres: this.availableGenres,
          topics: this.availableTopics,
          authors: this.availableAuthors
        };
      }
      return { genres: [], topics: [], authors: [] };
    } catch (error) {
      console.error('Failed to load tags:', error);
      return { genres: [], topics: [], authors: [] };
    }
  }

  /**
   * Create a new book
   * @param {Object} bookData
   * @returns {Promise<BookResult>}
   */
  static async createBook(bookData) {
    try {
      const result = await API.createBook(bookData);
      if (result.success) {
        this.books.unshift(result.book);
        return { success: true, book: result.book };
      }
      return { success: false, error: result.error || 'Failed to create book' };
    } catch (error) {
      console.error('Failed to create book:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Update an existing book (optimistic update with rollback on failure)
   * @param {Object} bookData - Must include `id`
   * @returns {Promise<BookResult>}
   */
  static async updateBook(bookData) {
    // Optimistic update: apply locally first
    const index = this.books.findIndex((b) => b.id === bookData.id);
    const previousBook = index !== -1 ? { ...this.books[index] } : null;
    if (index !== -1) {
      this.books[index] = { ...this.books[index], ...bookData };
    }

    try {
      const result = await API.updateBook(bookData);
      if (result.success) {
        // Reconcile with server response (server is source of truth)
        if (index !== -1) {
          this.books[index] = result.book;
        }
        return { success: true, book: result.book };
      }
      // Revert on failure
      if (previousBook && index !== -1) {
        this.books[index] = previousBook;
      }
      return { success: false, error: result.error || 'Failed to update book' };
    } catch (error) {
      // Revert on network error
      if (previousBook && index !== -1) {
        this.books[index] = previousBook;
      }
      console.error('Failed to update book:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Delete a book (optimistic delete with rollback on failure)
   * @param {number} bookId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async deleteBook(bookId) {
    // Optimistic delete: remove locally first
    const index = this.books.findIndex((b) => b.id === bookId);
    const previousBook = index !== -1 ? this.books[index] : null;
    if (index !== -1) {
      this.books.splice(index, 1);
    }

    try {
      const result = await API.deleteBook(bookId);
      if (result.success) {
        return { success: true };
      }
      // Revert on failure
      if (previousBook) {
        this.books.splice(index, 0, previousBook);
      }
      return { success: false, error: result.error || 'Failed to delete book' };
    } catch (error) {
      // Revert on network error
      if (previousBook) {
        this.books.splice(index, 0, previousBook);
      }
      console.error('Failed to delete book:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get books filtered and sorted by current criteria
   * @returns {Book[]}
   */
  static getFilteredBooks() {
    let filtered = this.books;

    // Apply status filter (multi-select)
    if (this.currentFilter.length > 0) {
      filtered = filtered.filter((book) => this.currentFilter.includes(book.status));
    }

    // Apply format filter
    if (this.currentAudiobookFilter !== 'all') {
      filtered = filtered.filter((book) => book.format === this.currentAudiobookFilter);
    }

    // Apply genre filter
    if (this.currentGenreFilter) {
      const gf = this.currentGenreFilter.toLowerCase();
      filtered = filtered.filter(
        (book) => book.genres && book.genres.some((g) => g.toLowerCase() === gf)
      );
    }

    // Apply topic filter
    if (this.currentTopicFilter) {
      const tf = this.currentTopicFilter.toLowerCase();
      filtered = filtered.filter(
        (book) => book.topics && book.topics.some((t) => t.toLowerCase() === tf)
      );
    }

    // Apply author filter
    if (this.currentAuthorFilter) {
      const af = this.currentAuthorFilter.toLowerCase();
      filtered = filtered.filter(
        (book) => book.authors && book.authors.some((a) => a.toLowerCase() === af)
      );
    }

    // Apply series filter
    if (this.currentSeriesFilter) {
      filtered = filtered.filter((book) => book.series_id === this.currentSeriesFilter);
    }

    // Apply search filter
    if (this.currentSearch) {
      const search = this.currentSearch.toLowerCase();
      filtered = filtered.filter((book) => {
        const nameMatch = book.name.toLowerCase().includes(search);
        const authorMatch = book.authors?.some((author) => author.toLowerCase().includes(search));
        const genreMatch = book.genres?.some((g) => g.toLowerCase().includes(search));
        const topicMatch = book.topics?.some((t) => t.toLowerCase().includes(search));
        const seriesMatch = book.series_name?.toLowerCase().includes(search);
        return nameMatch || authorMatch || genreMatch || topicMatch || seriesMatch;
      });
    }

    // Apply sorting
    filtered = [...filtered];
    switch (this.currentSort) {
      case 'title-az':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'title-za':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'author':
        filtered.sort((a, b) => {
          const aAuthor = a.authors?.[0] || '';
          const bAuthor = b.authors?.[0] || '';
          return aAuthor.localeCompare(bAuthor);
        });
        break;
      case 'finish-date':
        filtered.sort((a, b) => {
          const aDate = a.finish_date || '';
          const bDate = b.finish_date || '';
          return bDate.localeCompare(aDate);
        });
        break;
      case 'status':
        {
          const statusOrder = { 'want-to-read': 0, 'up-next': 1, reading: 2, read: 3 };
          filtered.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
        }
        break;
      case 'progress':
        filtered.sort((a, b) => {
          return this.getProgressPercent(b) - this.getProgressPercent(a);
        });
        break;
      case 'newest':
      default:
        // Already sorted by created_at DESC from API
        break;
    }

    return filtered;
  }

  /**
   * Get books with a specific status
   * @param {string} status
   * @returns {Book[]}
   */
  static getBooksByStatus(status) {
    return this.books.filter((book) => book.status === status);
  }

  /**
   * Set active status filter
   * @param {string[]} filterArray
   */
  static setFilter(filterArray) {
    this.currentFilter = filterArray;
  }

  /**
   * Set search query
   * @param {string} search
   */
  static setSearch(search) {
    this.currentSearch = search;
  }

  /**
   * Set format filter
   * @param {string} filter
   */
  static setAudiobookFilter(filter) {
    this.currentAudiobookFilter = filter;
  }

  /**
   * Set genre filter
   * @param {string} genre
   */
  static setGenreFilter(genre) {
    this.currentGenreFilter = genre;
  }

  /**
   * Set topic filter
   * @param {string} topic
   */
  static setTopicFilter(topic) {
    this.currentTopicFilter = topic;
  }

  /**
   * Set author filter
   * @param {string} author
   */
  static setAuthorFilter(author) {
    this.currentAuthorFilter = author;
  }

  /**
   * Set series filter
   * @param {number|null} seriesId
   */
  static setSeriesFilter(seriesId) {
    this.currentSeriesFilter = seriesId;
  }

  /**
   * Set sort mode
   * @param {string} sort
   */
  static setSort(sort) {
    this.currentSort = sort;
  }

  /**
   * Find a book by ID
   * @param {number} bookId
   * @returns {Book|undefined}
   */
  static getBook(bookId) {
    return this.books.find((b) => b.id === bookId);
  }

  /**
   * Calculate reading progress as a percentage (0–100)
   * @param {Book} book
   * @returns {number}
   */
  static getProgressPercent(book) {
    const format = book.format || 'paper';
    switch (format) {
      case 'paper':
        if (book.total_pages && book.current_page) {
          return Math.min(100, Math.round((book.current_page / book.total_pages) * 100));
        }
        return 0;
      case 'ebook':
        return Math.min(100, Math.round(book.current_percentage || 0));
      case 'audiobook':
        if (book.total_duration_min && book.current_duration_min) {
          return Math.min(
            100,
            Math.round((book.current_duration_min / book.total_duration_min) * 100)
          );
        }
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Estimate equivalent page count for a book (regardless of format)
   * @param {Book} book
   * @returns {number}
   */
  static getEstimatedPages(book) {
    const format = book.format || 'paper';
    switch (format) {
      case 'paper':
        return book.total_pages || 0;
      case 'ebook':
        return book.total_pages || 300;
      case 'audiobook':
        // Prefer actual paper page count if available
        if (book.total_pages) return book.total_pages;
        // Fallback: estimate from duration
        return book.total_duration_min ? Math.round(book.total_duration_min / 1.5) : 0;
      default:
        return 0;
    }
  }
}

export default BookManager;
