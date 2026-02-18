<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$db = Database::getInstance()->getConnection();

// Total users
$totalUsers = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();

// Total books
$totalBooks = (int)$db->query("SELECT COUNT(*) FROM bokbad_books")->fetchColumn();

// Total books read
$totalBooksRead = (int)$db->query("SELECT COUNT(*) FROM bokbad_books WHERE status = 'read'")->fetchColumn();

// Total pages read (from finished books)
$totalPages = (int)$db->query("
    SELECT COALESCE(SUM(total_pages), 0) FROM bokbad_books
    WHERE status = 'read' AND total_pages IS NOT NULL
")->fetchColumn();

// Total reading sessions
$totalSessions = (int)$db->query("SELECT COUNT(*) FROM bokbad_reading_sessions")->fetchColumn();

// Total listening minutes (from finished audiobooks)
$totalListeningMin = (int)$db->query("
    SELECT COALESCE(SUM(total_duration_min), 0) FROM bokbad_books
    WHERE status = 'read' AND format = 'audiobook' AND total_duration_min IS NOT NULL
")->fetchColumn();

// Per-user breakdown
$stmt = $db->query("
    SELECT 
        u.id,
        u.username,
        u.display_name,
        u.role,
        COUNT(b.id) as book_count,
        SUM(CASE WHEN b.status = 'read' THEN 1 ELSE 0 END) as books_read,
        COALESCE(SUM(CASE WHEN b.status = 'read' AND b.total_pages IS NOT NULL THEN b.total_pages ELSE 0 END), 0) as pages_read,
        COALESCE(SUM(CASE WHEN b.status = 'reading' THEN 1 ELSE 0 END), 0) as currently_reading
    FROM users u
    LEFT JOIN bokbad_books b ON b.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
");
$perUser = $stmt->fetchAll();

sendSuccess([
    'stats' => [
        'totalUsers' => $totalUsers,
        'totalBooks' => $totalBooks,
        'totalBooksRead' => $totalBooksRead,
        'totalPages' => $totalPages,
        'totalSessions' => $totalSessions,
        'totalListeningMinutes' => $totalListeningMin
    ],
    'perUser' => $perUser
]);
