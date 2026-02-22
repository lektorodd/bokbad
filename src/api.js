// API client for backend communication
const API_BASE = '/api';

class API {
  // Authentication
  static async login(username, password, rememberMe = true) {
    return this.post('/auth/login.php', { username, password, remember_me: rememberMe });
  }

  static async logout() {
    return this.post('/auth/logout.php');
  }

  static async checkAuth() {
    return this.get('/auth/check.php');
  }

  // Books
  static async getBooks(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/books/index.php?${params}`);
  }

  static async createBook(bookData) {
    return this.post('/books/index.php', bookData);
  }

  static async updateBook(bookData) {
    return this.put('/books/index.php', bookData);
  }

  static async deleteBook(bookId) {
    return this.delete(`/books/index.php?id=${bookId}`);
  }

  // Upload
  static async uploadCover(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/upload/cover.php`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    return response.json();
  }

  // Proxy remote cover image (download + cache locally)
  static async proxyCover(url) {
    return this.post('/upload/proxy_cover.php', { url });
  }

  // Metadata
  static async fetchMetadata(isbn) {
    return this.get(`/metadata/isbn.php?isbn=${encodeURIComponent(isbn)}`);
  }

  // Lookup existing book by title (for cover reuse)
  static async lookupBook(name) {
    return this.get(`/books/lookup.php?name=${encodeURIComponent(name)}`);
  }

  // Tags (for autocomplete)
  static async getTags() {
    return this.get('/books/tags.php');
  }

  // Stats
  static async getSummaryStats(from, to) {
    let url = '/stats/summary.php';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.get(url);
  }

  static async getYearlyStats(year, compare = false) {
    const params = compare ? `year=${year}&compare=1` : `year=${year}`;
    return this.get(`/stats/yearly.php?${params}`);
  }

  static async getReadingPace(from, to) {
    let url = '/stats/reading_pace.php';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.get(url);
  }

  static async getGenreStats() {
    return this.get('/stats/genres.php');
  }

  static async getStreakData(days = 10) {
    return this.get(`/stats/streak.php?days=${days}`);
  }

  static async getDailyActivity(days = 30) {
    return this.get(`/stats/daily_activity.php?days=${days}`);
  }

  static async getDashboardStats(from, to) {
    let url = '/stats/dashboard_stats.php';
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (params.length) url += '?' + params.join('&');
    return this.get(url);
  }

  static async getActivityCalendar(year, month) {
    return this.get(`/stats/activity_calendar.php?year=${year}&month=${month}`);
  }

  // Reading Sessions
  static async getReadingSessions(bookId) {
    return this.get(`/books/reading_sessions.php?book_id=${bookId}`);
  }

  static async createReadingSession(data) {
    return this.post('/books/reading_sessions.php', data);
  }

  static async deleteReadingSession(id) {
    return this.delete(`/books/reading_sessions.php?id=${id}`);
  }

  // Reading Goals
  static async getGoal(year) {
    return this.get(`/stats/goals.php?year=${year}`);
  }

  static async setGoal(year, data) {
    return this.post('/stats/goals.php', { year, ...data });
  }

  // Series
  static async getSeries() {
    return this.get('/books/series.php');
  }

  static async createSeries(name, totalBooks = null) {
    return this.post('/books/series.php', { name, totalBooks });
  }

  static async deleteSeries(id) {
    return this.delete(`/books/series.php?id=${id}`);
  }

  // Backup / Restore
  static async exportData() {
    return this.get('/utils/backup.php');
  }

  static async importData(data) {
    return this.post('/utils/backup.php', data);
  }

  // Password change (self-service)
  static async changePassword(currentPassword, newPassword) {
    return this.post('/auth/password.php', {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  // Admin - User Management
  static async getUsers() {
    return this.get('/admin/users.php');
  }

  static async createUser(data) {
    return this.post('/admin/users.php', data);
  }

  static async updateUser(data) {
    return this.put('/admin/users.php', data);
  }

  static async resetUserPassword(id, newPassword) {
    return this.patch('/admin/users.php', { id, new_password: newPassword });
  }

  static async deleteUser(id) {
    return this.delete(`/admin/users.php?id=${id}`);
  }

  // Admin - Global Stats
  static async getGlobalStats() {
    return this.get('/admin/stats.php');
  }

  // HTTP methods
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

  static async post(endpoint, data = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  static async put(endpoint, data = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  static async patch(endpoint, data = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return response.json();
  }

  static async delete(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
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
}

export default API;
