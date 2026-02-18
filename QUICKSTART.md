# Quick Start Guide - Local Testing

## Prerequisites Check
- ✅ Node.js installed (you already have this - Vite is running)
- ✅ PHP installed (check with `php -v`)
- ✅ MySQL installed (check with `mysql --version`)

## 3-Step Setup

### Step 1: Create Database (30 seconds)

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE bokbad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import schema (creates tables and test user)
mysql -u root -p bokbad < database/schema.sql
```

**Note:** If you don't have a MySQL root password, just press Enter when prompted.

### Step 2: Configure Database (1 minute)

Edit `api/config/config.php` and update these lines:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'bokbad');
define('DB_USER', 'root');           // Your MySQL username
define('DB_PASS', '');               // Your MySQL password
```

### Step 3: Start Backend (5 seconds)

Open a new terminal and run:

```bash
cd /Users/torodd/GitHub/bokbad
php -S localhost:8000
```

## Done! 🎉

1. Frontend: http://localhost:5173 (already running)
2. Backend: http://localhost:8000 (just started)
3. Login with: `testesen` / `password`

## Testing the App

Try these:
- ✅ Log in
- ✅ Add a book
- ✅ Upload a cover image
- ✅ Try ISBN lookup (e.g., `9780134685991` for "Effective Java")
- ✅ View dashboard
- ✅ Search and filter books

## Troubleshooting

**"Connection refused" error?**
- Make sure both servers are running (check terminals)

**"Database connection failed"?**
- Verify credentials in `api/config/config.php`
- Check MySQL is running: `mysql.server status`

**"Table doesn't exist"?**
- Re-run: `mysql -u root -p bokbad < database/schema.sql`

**Can't upload images?**
- Check `uploads/covers/` directory exists and is writable
- Run: `chmod 755 uploads/covers/`

## What's Already Done

✅ Frontend dev server running (Vite)
✅ All code written and ready
✅ Test user created
✅ Database schema ready to import

You just need MySQL configured and the PHP server started!
