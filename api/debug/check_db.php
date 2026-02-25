<?php
// TEMPORARY debug endpoint - remove after debugging
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

// Keep disabled by default in production.
if (getenv('BOKBAD_DEBUG_ENDPOINT') !== '1') {
    sendError('Not found', 404);
}

requireAdmin();

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

$results = [];

// 1. Show table structure
$stmt = $db->query("SHOW CREATE TABLE bokbad_books");
$results['table_create'] = $stmt->fetch()['Create Table'] ?? 'N/A';

// 2. Show triggers
$stmt = $db->query("SHOW TRIGGERS LIKE 'bokbad_books'");
$results['triggers'] = $stmt->fetchAll();

// 3. Show ALL books (not filtered by user)
$stmt = $db->query("SELECT id, user_id, name, status, created_at FROM bokbad_books ORDER BY id");
$results['all_books'] = $stmt->fetchAll();

// 4. Count books per user
$stmt = $db->query("SELECT user_id, COUNT(*) as count FROM bokbad_books GROUP BY user_id");
$results['books_per_user'] = $stmt->fetchAll();

// 5. Show all users
$stmt = $db->query("SELECT id, username, created_at FROM users ORDER BY id");
$results['users'] = $stmt->fetchAll();

// 6. Current session info
$results['current_user_id'] = $userId;

// 7. Auto increment value
$stmt = $db->query("SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_NAME = 'bokbad_books'");
$row = $stmt->fetch();
$results['auto_increment'] = $row['AUTO_INCREMENT'] ?? 'N/A';

header('Content-Type: application/json');
echo json_encode($results, JSON_PRETTY_PRINT);
