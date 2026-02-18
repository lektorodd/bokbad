<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');  // REPLACE WITH YOUR ACTUAL PASSWORD
define('DB_CHARSET', 'utf8mb4');

// Application configuration
define('UPLOAD_DIR', __DIR__ . '/../../uploads/covers/');
define('UPLOAD_URL', '/uploads/covers/');
define('MAX_UPLOAD_SIZE', 2 * 1024 * 1024); // 2MB
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp']);

// Session configuration
define('SESSION_LIFETIME', 60 * 60 * 24 * 30); // 30 days

// Google Books API (no key required for basic usage)
define('GOOGLE_BOOKS_API', 'https://www.googleapis.com/books/v1/volumes');

// Error reporting (set to 0 in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Timezone
date_default_timezone_set('Europe/Oslo');

// CORS settings - UPDATE TO YOUR DOMAIN
header('Access-Control-Allow-Origin: https://your-domain.com');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
