<?php
/**
 * Lookup endpoint: find existing book metadata by title.
 * GET ?name=...  →  { success: true, book: { title, authors, coverImage, totalPages, isbn } }
 * Searches across all users, returns only safe public metadata.
 */
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$name = trim($_GET['name'] ?? '');

if (strlen($name) < 3) {
    sendError('Name must be at least 3 characters', 400);
}

$db = Database::getInstance()->getConnection();

// Search for books with a cover image that match the query
// Order by shortest name first (best match) to avoid overly broad results
$stmt = $db->prepare("
    SELECT name, authors, cover_image, total_pages, isbn
    FROM bokbad_books
    WHERE name LIKE ? AND cover_image IS NOT NULL AND cover_image != ''
    ORDER BY CHAR_LENGTH(name) ASC
    LIMIT 1
");
$stmt->execute(['%' . $name . '%']);
$book = $stmt->fetch();

if ($book) {
    sendSuccess(['book' => [
        'title'      => $book['name'],
        'authors'    => json_decode($book['authors'], true) ?: [],
        'coverImage' => $book['cover_image'],
        'totalPages' => $book['total_pages'] ? (int)$book['total_pages'] : null,
        'isbn'       => $book['isbn'] ?: null,
    ]]);
} else {
    sendSuccess(['book' => null]);
}
