<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // List all series with book counts
    $stmt = $db->prepare("
        SELECT s.*, 
            COUNT(b.id) as book_count,
            SUM(CASE WHEN b.status = 'read' THEN 1 ELSE 0 END) as books_read
        FROM bokbad_series s
        LEFT JOIN bokbad_books b ON b.series_id = s.id AND b.user_id = ?
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.name ASC
    ");
    $stmt->execute([$userId, $userId]);
    $rows = $stmt->fetchAll();

    $series = array_map(function($row) {
        return [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'totalBooks' => $row['total_books'] ? (int)$row['total_books'] : null,
            'bookCount' => (int)$row['book_count'],
            'booksRead' => (int)$row['books_read'],
        ];
    }, $rows);

    sendSuccess(['series' => $series]);

} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    $totalBooks = isset($data['totalBooks']) ? (int)$data['totalBooks'] : null;

    if (!$name) {
        sendError('Series name is required');
    }

    $stmt = $db->prepare("INSERT INTO bokbad_series (user_id, name, total_books) VALUES (?, ?, ?)");
    $stmt->execute([$userId, $name, $totalBooks]);
    $id = $db->lastInsertId();

    sendSuccess(['series' => [
        'id' => (int)$id,
        'name' => $name,
        'totalBooks' => $totalBooks,
        'bookCount' => 0,
        'booksRead' => 0,
    ]]);

} elseif ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        sendError('Series ID is required');
    }

    $stmt = $db->prepare("DELETE FROM bokbad_series WHERE id = ? AND user_id = ?");
    $stmt->execute([(int)$id, $userId]);

    sendSuccess(['message' => 'Series deleted']);

} else {
    sendError('Method not allowed', 405);
}
