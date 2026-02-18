# Bokbad Deployment Guide for one.com

> **📖 For a complete step-by-step guide, see:** [One.com Deployment Guide](file:///Users/torodd/.gemini/antigravity/brain/373ac126-20fd-4fdd-b50f-1cdc617d7ee4/one_com_deployment.md)

This document provides a quick reference. For detailed instructions with troubleshooting, use the guide above.

---

## Pre-Deployment Checklist

- [ ] Database created in one.com control panel
- [ ] Database credentials noted
- [ ] FTP/SFTP access configured
- [ ] Domain/subdomain configured

## Step-by-Step Deployment

### 1. Build the Frontend

```bash
cd /Users/torodd/GitHub/bokbad
npm run build
```

This creates a `dist/` directory with optimized files.

### 2. Prepare Files for Upload

Create a deployment package:
```
deployment/
├── index.html (from dist/)
├── assets/ (from dist/assets/)
├── vite.svg (from dist/)
├── manifest.json (from dist/)
├── api/ (entire directory)
├── database/ (entire directory)
└── uploads/ (create empty directory)
    └── covers/ (create empty directory)
```

### 3. Upload to one.com

Using FTP/SFTP client (FileZilla, Cyberduck, etc.):

1. Connect to your one.com hosting
2. Navigate to your web root (usually `public_html/` or `www/`)
3. Upload all files from the deployment package
4. Set permissions on `uploads/covers/` to 755 or 777

### 4. Configure Database

1. Log into one.com control panel
2. Go to MySQL databases
3. Create new database (note the name, user, password)
4. Use phpMyAdmin or MySQL command line:
   - Import `database/schema.sql`
   - Verify tables were created

### 5. Update Configuration

Edit `api/config/config.php` on the server:

```php
define('DB_HOST', 'your-db-host.mysql.database');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
```

Also update CORS settings if needed:
```php
header('Access-Control-Allow-Origin: https://yourdomain.com');
```

### 6. Create .htaccess (if needed)

If using Apache, create `.htaccess` in web root:

```apache
# Enable rewrite engine
RewriteEngine On

# Redirect API requests
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^api/(.*)$ api/$1 [L]

# SPA fallback
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [L]

# Security headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

# PHP settings
php_value upload_max_filesize 2M
php_value post_max_size 2M
php_value max_execution_time 30
```

### 7. Test the Application

1. Visit your domain
2. Try logging in (user@bokbad.com / password123)
3. Test adding a book
4. Test uploading a cover image
5. Test ISBN lookup
6. Check dashboard

### 8. Security Steps

1. **Change default password:**
   - Log in with default credentials
   - Use phpMyAdmin to update password hash:
   ```sql
   UPDATE users 
   SET password_hash = '$2y$10$YOUR_NEW_HASH' 
   WHERE email = 'user@bokbad.com';
   ```
   - Generate hash in PHP:
   ```php
   echo password_hash('your_new_password', PASSWORD_DEFAULT);
   ```

2. **Update email:**
   ```sql
   UPDATE users 
   SET email = 'your@email.com' 
   WHERE email = 'user@bokbad.com';
   ```

3. **Disable error display:**
   In `api/config/config.php`:
   ```php
   error_reporting(0);
   ini_set('display_errors', 0);
   ```

4. **Set secure permissions:**
   - Files: 644
   - Directories: 755
   - uploads/covers/: 755 or 777 (writable)

## Troubleshooting

### Images not uploading
- Check `uploads/covers/` exists and is writable
- Verify PHP upload settings in `.htaccess` or `php.ini`
- Check error logs

### API not responding
- Verify file paths in `config.php`
- Check PHP error logs
- Ensure all PHP files have correct permissions

### Database connection failed
- Double-check credentials in `config.php`
- Verify database host (might be different from 'localhost')
- Ensure database user has proper permissions

### Session issues
- Check PHP session directory is writable
- Verify session cookies are being set
- Check CORS headers match your domain

## Maintenance

### Backup Database
```bash
mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
```

### Monitor Disk Usage
Check `uploads/covers/` directory size regularly.

### Update Application
1. Build new version locally
2. Upload only changed files
3. Clear browser cache
4. Test thoroughly

## Support

For one.com specific issues:
- Check one.com documentation
- Contact one.com support
- Check PHP version compatibility (7.4+)
