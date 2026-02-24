# Bokbad - Book Tracking App ![Version](https://img.shields.io/badge/version-1.13.0-blue.svg)

A self-hosted, mobile-first web app for tracking your reading life. Keep a personal library of books you've read, are reading, or want to read — log reading sessions, set yearly goals, track streaks, and visualize your progress with charts and statistics. Supports paper books, e-books, and audiobooks with format-specific progress tracking, ISBN barcode scanning, and multi-language support (English & Norwegian).

Built as a lightweight PWA that works great from your phone's home screen — perfect for families or small groups who want a private, ad-free alternative to Goodreads.

## Development Setup

### Prerequisites
- PHP 7.4+ with MySQL support
- MySQL database
- Node.js 16+ and npm
- Web server (Apache/Nginx) or PHP built-in server

### Installation

1. **Clone and install dependencies:**
```bash
git clone https://github.com/lektorodd/bokbad.git
cd bokbad
npm install
```

2. **Set up database:**
```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE bokbad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

# Import schema
mysql -u root -p bokbad < database/schema.sql
```

3. **Configure API:**
Edit `api/config/config.php` and update:
- Database credentials (DB_USER, DB_PASS)
- Upload directory paths if needed

4. **Create upload directory:**
```bash
mkdir -p uploads/covers
chmod 755 uploads/covers
```

5. **Start development servers:**

Terminal 1 - Frontend (Vite):
```bash
npm run dev
```

Terminal 2 - Backend (PHP):
```bash
php -S localhost:8000
```

6. **Configure proxy (if needed):**
If running frontend and backend on different ports, update `vite.config.js` to proxy API requests.

### Default Login
- Username: `testesen`
- Password: `password`

**IMPORTANT:** Change the default password in production!

## Project Structure

```
bokbad/
├── api/                    # PHP backend
│   ├── auth/              # Authentication endpoints
│   ├── books/             # Book CRUD endpoints
│   ├── upload/            # Image upload handler
│   ├── metadata/          # ISBN lookup
│   ├── stats/             # Dashboard statistics
│   ├── config/            # Configuration files
│   └── utils/             # Helper functions
├── database/              # Database schema
├── src/                   # Frontend source
│   ├── main.js           # Main app logic
│   ├── api.js            # API client
│   ├── auth.js           # Authentication
│   ├── bookManager.js    # Book management
│   └── style.css         # Styles
├── uploads/               # User uploads
│   └── covers/           # Book covers
├── public/                # Static assets
└── index.html            # Main HTML

```

## Features

- ✅ User authentication
- ✅ Multi-user support with admin panel
- ✅ Add/edit/delete books
- ✅ Multiple authors support
- ✅ Cover image upload from camera/gallery
- ✅ Genre and topic categorization
- ✅ Three book formats (paper, e-book, audiobook) with format-specific progress
- ✅ Four reading statuses (Want to Read, Up Next, Reading, Read)
- ✅ Start and finish dates
- ✅ Thoughts/key takeaways notes (Markdown support)
- ✅ ISBN metadata lookup (Google Books + Open Library)
- ✅ ISBN barcode scanning
- ✅ Cover reuse from library (ISBN + title-match lookup)
- ✅ Search, filter, and sort books
- ✅ Dashboard with statistics and charts
- ✅ Reading sessions / habit tracking
- ✅ Reading streaks
- ✅ Reading goals (yearly books & pages)
- ✅ Series tracking
- ✅ Activity calendar
- ✅ Export/import data (backup & restore)
- ✅ Dark mode
- ✅ Multi-language support (English & Norwegian)
- ✅ Mobile-first responsive design
- ✅ PWA support
- ✅ Pull-to-refresh & swipe gestures

## Deployment

1. **Build frontend:**
```bash
npm run build
```

2. **Upload files:**
- Upload `dist/` contents to web root
- Upload `api/` directory
- Upload `database/` directory
- Create `uploads/covers/` directory (writable)

3. **Configure database:**
- Create a MySQL database on your hosting provider
- Import `database/schema.sql`
- Copy `api/config/config.example.php` to `api/config/config.php` and fill in your credentials

4. **Set permissions:**
- Ensure `uploads/covers/` is writable (755 or 777)

5. **Test:**
- Visit your domain
- Log in with default credentials
- Change password immediately!

## API Endpoints

### Authentication
- `POST /api/auth/login.php` - Login
- `POST /api/auth/logout.php` - Logout
- `GET /api/auth/check.php` - Check auth status

### Books
- `GET /api/books/index.php` - Get all books (with filters)
- `POST /api/books/index.php` - Create book
- `PUT /api/books/index.php` - Update book
- `DELETE /api/books/index.php?id={id}` - Delete book

### Upload
- `POST /api/upload/cover.php` - Upload cover image

### Metadata
- `GET /api/metadata/isbn.php?isbn={isbn}` - Fetch book metadata (checks local DB first)

### Book Lookup
- `GET /api/books/lookup.php?name={name}` - Find existing book by title (for cover reuse)

### Statistics
- `GET /api/stats/summary.php` - Get summary stats
- `GET /api/stats/yearly.php?year={year}` - Get yearly stats

## Troubleshooting

### CORS Issues
If you see CORS errors, ensure `api/config/config.php` has correct CORS headers for your domain.

### Upload Failures
- Check `uploads/covers/` directory exists and is writable
- Verify `MAX_UPLOAD_SIZE` in `config.php`
- Check PHP `upload_max_filesize` and `post_max_size` settings

### Database Connection
- Verify credentials in `api/config/config.php`
- Ensure MySQL is running
- Check database exists and schema is imported

### Session Issues
- Ensure PHP sessions are enabled
- Check session directory is writable

## Future Enhancements

- [ ] Social features
- [ ] Goodreads import

## License

Private project for personal use.
