import API from './api.js';

class BookManager {
    static books = [];
    static currentFilter = []; // empty = all
    static currentSearch = '';
    static currentAudiobookFilter = 'all'; // 'all', 'audiobook', 'physical'
    static currentGenreFilter = '';
    static currentTopicFilter = '';
    static currentSort = 'newest';
    static availableGenres = [];
    static availableTopics = [];
    static availableAuthors = [];

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

    static async loadTags() {
        try {
            const result = await API.getTags();
            if (result.success) {
                this.availableGenres = result.genres || [];
                this.availableTopics = result.topics || [];
                this.availableAuthors = result.authors || [];
                return { genres: this.availableGenres, topics: this.availableTopics, authors: this.availableAuthors };
            }
            return { genres: [], topics: [], authors: [] };
        } catch (error) {
            console.error('Failed to load tags:', error);
            return { genres: [], topics: [] };
        }
    }

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

    static async updateBook(bookData) {
        // Optimistic update: apply locally first
        const index = this.books.findIndex(b => b.id === bookData.id);
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

    static async deleteBook(bookId) {
        // Optimistic delete: remove locally first
        const index = this.books.findIndex(b => b.id === bookId);
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

    static getFilteredBooks() {
        let filtered = this.books;

        // Apply status filter (multi-select)
        if (this.currentFilter.length > 0) {
            filtered = filtered.filter(book => this.currentFilter.includes(book.status));
        }

        // Apply format filter
        if (this.currentAudiobookFilter !== 'all') {
            filtered = filtered.filter(book => book.format === this.currentAudiobookFilter);
        }

        // Apply genre filter
        if (this.currentGenreFilter) {
            const gf = this.currentGenreFilter.toLowerCase();
            filtered = filtered.filter(book =>
                book.genres && book.genres.some(g => g.toLowerCase() === gf)
            );
        }

        // Apply topic filter
        if (this.currentTopicFilter) {
            filtered = filtered.filter(book =>
                book.topics && book.topics.includes(this.currentTopicFilter)
            );
        }

        // Apply search filter
        if (this.currentSearch) {
            const search = this.currentSearch.toLowerCase();
            filtered = filtered.filter(book => {
                const nameMatch = book.name.toLowerCase().includes(search);
                const authorMatch = book.authors?.some(author =>
                    author.toLowerCase().includes(search)
                );
                const genreMatch = book.genres?.some(g =>
                    g.toLowerCase().includes(search)
                );
                const topicMatch = book.topics?.some(t =>
                    t.toLowerCase().includes(search)
                );
                return nameMatch || authorMatch || genreMatch || topicMatch;
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
                    const statusOrder = { 'reading': 0, 'up-next': 1, 'want-to-read': 2, 'read': 3 };
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

    static getBooksByStatus(status) {
        return this.books.filter(book => book.status === status);
    }

    static setFilter(filterArray) {
        this.currentFilter = filterArray;
    }

    static setSearch(search) {
        this.currentSearch = search;
    }

    static setAudiobookFilter(filter) {
        this.currentAudiobookFilter = filter;
    }

    static setGenreFilter(genre) {
        this.currentGenreFilter = genre;
    }

    static setTopicFilter(topic) {
        this.currentTopicFilter = topic;
    }

    static setSort(sort) {
        this.currentSort = sort;
    }

    static getBook(bookId) {
        return this.books.find(b => b.id === bookId);
    }

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
                    return Math.min(100, Math.round((book.current_duration_min / book.total_duration_min) * 100));
                }
                return 0;
            default:
                return 0;
        }
    }

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
