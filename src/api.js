// @ts-check

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {string} [error] - Error message if unsuccessful
 * @property {*} [data] - Response payload (varies by endpoint)
 */

// API client for backend communication
const API_BASE = '/api';

// CSRF token storage
/** @type {string|null} */
let csrfToken = null;

class API {
  /**
   * Store CSRF token from auth check response
   * @param {string} token
   */
  static setCsrfToken(token) {
    csrfToken = token;
  }

  // Authentication

  /**
   * Authenticate a user
   * @param {string} username
   * @param {string} password
   * @param {boolean} [rememberMe=true]
   * @returns {Promise<Object>}
   */
  static async login(username, password, rememberMe = true) {
    return this.post('/auth/login.php', { username, password, remember_me: rememberMe });
  }

  /** @returns {Promise<Object>} */
  static async logout() {
    return this.post('/auth/logout.php');
  }

  /**
   * Check auth status and store CSRF token
   * @returns {Promise<Object>}
   */
  static async checkAuth() {
    const result = await this.get('/auth/check.php');
    if (result.success && result.csrf_token) {
      this.setCsrfToken(result.csrf_token);
    }
    return result;
  }

  // Books

  /**
   * Fetch books with optional filters
   * @param {Object} [filters={}]
   * @returns {Promise<Object>}
   */
  static async getBooks(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/books/index.php?${params}`);
  }

  /**
   * Create a new book
   * @param {Object} bookData
   * @returns {Promise<Object>}
   */
  static async createBook(bookData) {
    return this.post('/books/index.php', bookData);
  }

  /**
   * Update an existing book
   * @param {Object} bookData - Must include `id`
   * @returns {Promise<Object>}
   */
  static async updateBook(bookData) {
    return this.put('/books/index.php', bookData);
  }

  /**
   * Delete a book by ID
   * @param {number} bookId
   * @returns {Promise<Object>}
   */
  static async deleteBook(bookId) {
    return this.delete(`/books/index.php?id=${bookId}`);
  }

  // Upload

  /**
   * Upload a cover image file
   * @param {File} file
   * @returns {Promise<Object>}
   */
  static async uploadCover(file) {
    const formData = new FormData();
    formData.append('image', file);

    /** @type {Record<string, string>} */
    const headers = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${API_BASE}/upload/cover.php`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers
    });

    return response.json();
  }

  /**
   * Proxy a remote cover image URL (download + cache locally)
   * @param {string} url
   * @returns {Promise<Object>}
   */
  static async proxyCover(url) {
    return this.post('/upload/proxy_cover.php', { url });
  }

  // Metadata

  /**
   * Fetch book metadata by ISBN
   * @param {string} isbn
   * @returns {Promise<Object>}
   */
  static async fetchMetadata(isbn) {
    return this.get(`/metadata/isbn.php?isbn=${encodeURIComponent(isbn)}`);
  }

  /**
   * Lookup existing book by title (for cover reuse)
   * @param {string} name
   * @returns {Promise<Object>}
   */
  static async lookupBook(name) {
    return this.get(`/books/lookup.php?name=${encodeURIComponent(name)}`);
  }

  /**
   * Get tag suggestions for autocomplete
   * @returns {Promise<Object>}
   */
  static async getTags() {
    return this.get('/books/tags.php');
  }

  // Stats

  /**
   * Get summary statistics for a date range
   * @param {string} [from]
   * @param {string} [to]
   * @returns {Promise<Object>}
   */
  static async getSummaryStats(from, to) {
    let url = '/stats/summary.php';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.get(url);
  }

  /**
   * Get yearly statistics
   * @param {number} year
   * @param {boolean} [compare=false]
   * @returns {Promise<Object>}
   */
  static async getYearlyStats(year, compare = false) {
    const params = compare ? `year=${year}&compare=1` : `year=${year}`;
    return this.get(`/stats/yearly.php?${params}`);
  }

  /**
   * Get reading pace data
   * @param {string} [from]
   * @param {string} [to]
   * @returns {Promise<Object>}
   */
  static async getReadingPace(from, to) {
    let url = '/stats/reading_pace.php';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.get(url);
  }

  /** @returns {Promise<Object>} */
  static async getGenreStats() {
    return this.get('/stats/genres.php');
  }

  /**
   * Get streak data
   * @param {number} [days=10]
   * @returns {Promise<Object>}
   */
  static async getStreakData(days = 10) {
    return this.get(`/stats/streak.php?days=${days}`);
  }

  /**
   * Get daily activity data
   * @param {number} [days=30]
   * @returns {Promise<Object>}
   */
  static async getDailyActivity(days = 30) {
    return this.get(`/stats/daily_activity.php?days=${days}`);
  }

  /**
   * Get dashboard statistics for a date range
   * @param {string} [from]
   * @param {string} [to]
   * @returns {Promise<Object>}
   */
  static async getDashboardStats(from, to) {
    let url = '/stats/dashboard_stats.php';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.get(url);
  }

  /**
   * Get activity calendar heatmap for a month
   * @param {number} year
   * @param {number} month
   * @returns {Promise<Object>}
   */
  static async getActivityCalendar(year, month) {
    return this.get(`/stats/activity_calendar.php?year=${year}&month=${month}`);
  }

  // Reading Sessions

  /**
   * Get reading sessions for a book
   * @param {number} bookId
   * @returns {Promise<Object>}
   */
  static async getReadingSessions(bookId) {
    return this.get(`/books/reading_sessions.php?book_id=${bookId}`);
  }

  /**
   * Create a new reading session
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async createReadingSession(data) {
    return this.post('/books/reading_sessions.php', data);
  }

  /**
   * Delete a reading session
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async deleteReadingSession(id) {
    return this.delete(`/books/reading_sessions.php?id=${id}`);
  }

  // Reading Goals

  /**
   * Get reading goal for a year
   * @param {number} year
   * @returns {Promise<Object>}
   */
  static async getGoal(year) {
    return this.get(`/stats/goals.php?year=${year}`);
  }

  /**
   * Set reading goal for a year
   * @param {number} year
   * @param {Object} data - Goal data (targetBooks, targetPages)
   * @returns {Promise<Object>}
   */
  static async setGoal(year, data) {
    return this.post('/stats/goals.php', { year, ...data });
  }

  // Series

  /** @returns {Promise<Object>} */
  static async getSeries() {
    return this.get('/books/series.php');
  }

  /**
   * Create a new series
   * @param {string} name
   * @param {number|null} [totalBooks=null]
   * @returns {Promise<Object>}
   */
  static async createSeries(name, totalBooks = null) {
    return this.post('/books/series.php', { name, totalBooks });
  }

  /**
   * Delete a series
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async deleteSeries(id) {
    return this.delete(`/books/series.php?id=${id}`);
  }

  // Backup / Restore

  /** @returns {Promise<Object>} */
  static async exportData() {
    return this.get('/utils/backup.php');
  }

  /**
   * Import backup data
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async importData(data) {
    return this.post('/utils/backup.php', data);
  }

  // Feedback

  /**
   * Submit user feedback
   * @param {string} message
   * @returns {Promise<Object>}
   */
  static async submitFeedback(message) {
    return this.post('/feedback/index.php', { message });
  }

  /**
   * Change the current user's password
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  static async changePassword(currentPassword, newPassword) {
    return this.post('/auth/password.php', {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  // Admin - User Management

  /** @returns {Promise<Object>} */
  static async getUsers() {
    return this.get('/admin/users.php');
  }

  /**
   * Create a new user (admin only)
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async createUser(data) {
    return this.post('/admin/users.php', data);
  }

  /**
   * Update user details (admin only)
   * @param {Object} data - Must include `id`
   * @returns {Promise<Object>}
   */
  static async updateUser(data) {
    return this.put('/admin/users.php', data);
  }

  /**
   * Reset a user's password (admin only)
   * @param {number} id
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  static async resetUserPassword(id, newPassword) {
    return this.patch('/admin/users.php', { id, new_password: newPassword });
  }

  /**
   * Delete a user (admin only)
   * @param {number} id
   * @returns {Promise<Object>}
   */
  static async deleteUser(id) {
    return this.delete(`/admin/users.php?id=${id}`);
  }

  // Admin - Global Stats

  /** @returns {Promise<Object>} */
  static async getGlobalStats() {
    return this.get('/admin/stats.php');
  }

  // HTTP methods

  /**
   * @param {string} endpoint
   * @returns {Promise<any>}
   */
  static async get(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  /**
   * @param {string} endpoint
   * @param {Object} [data={}]
   * @returns {Promise<any>}
   */
  static async post(endpoint, data = {}) {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(data)
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  /**
   * @param {string} endpoint
   * @param {Object} [data={}]
   * @returns {Promise<any>}
   */
  static async put(endpoint, data = {}) {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: JSON.stringify(data)
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  /**
   * @param {string} endpoint
   * @param {Object} [data={}]
   * @returns {Promise<any>}
   */
  static async patch(endpoint, data = {}) {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: JSON.stringify(data)
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  /**
   * @param {string} endpoint
   * @returns {Promise<any>}
   */
  static async delete(endpoint) {
    /** @type {Record<string, string>} */
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }
}

export default API;
