<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $year = $_GET['year'] ?? date('Y');
    $year = (int)$year;

    // Get goal
    $stmt = $db->prepare("SELECT * FROM bokbad_reading_goals WHERE user_id = ? AND year = ?");
    $stmt->execute([$userId, $year]);
    $goal = $stmt->fetch();

    // Get progress: books read this year
    $stmt = $db->prepare("
        SELECT COUNT(*) as books_read
        FROM bokbad_books
        WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
            AND YEAR(finish_date) = ?
    ");
    $stmt->execute([$userId, $year]);
    $booksRead = (int)$stmt->fetch()['books_read'];

    // Get progress: pages read this year (estimated across formats)
    $pagesRead = 0;
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(CASE 
            WHEN total_pages IS NOT NULL THEN total_pages
            WHEN format = 'audiobook' THEN ROUND(COALESCE(total_duration_min, 0) / 1.5)
            ELSE 300
        END), 0) as total
        FROM bokbad_books
        WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
            AND YEAR(finish_date) = ?
    ");
    $stmt->execute([$userId, $year]);
    $pagesRead = (int)$stmt->fetch()['total'];

    // Get list of books read this year (for display)
    $stmt = $db->prepare("
        SELECT id, name, finish_date
        FROM bokbad_books
        WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
            AND YEAR(finish_date) = ?
        ORDER BY finish_date DESC
    ");
    $stmt->execute([$userId, $year]);
    $booksReadList = $stmt->fetchAll(PDO::FETCH_ASSOC);

    sendSuccess([
        'goal' => $goal ? [
            'id' => (int)$goal['id'],
            'year' => (int)$goal['year'],
            'targetBooks' => $goal['target_books'] ? (int)$goal['target_books'] : null,
            'targetPages' => $goal['target_pages'] ? (int)$goal['target_pages'] : null,
        ] : null,
        'progress' => [
            'booksRead' => $booksRead,
            'pagesRead' => $pagesRead,
            'booksReadList' => $booksReadList,
        ]
    ]);
} elseif ($method === 'POST' || $method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $year = $data['year'] ?? date('Y');
    $targetBooks = isset($data['targetBooks']) ? (int)$data['targetBooks'] : null;
    $targetPages = isset($data['targetPages']) ? (int)$data['targetPages'] : null;

    if (!$targetBooks && !$targetPages) {
        sendError('At least one target (books or pages) is required');
    }

    // Upsert: insert or update
    $stmt = $db->prepare("
        INSERT INTO bokbad_reading_goals (user_id, year, target_books, target_pages)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE target_books = VALUES(target_books), target_pages = VALUES(target_pages)
    ");
    $stmt->execute([$userId, (int)$year, $targetBooks, $targetPages]);

    sendSuccess(['message' => 'Goal saved']);
} elseif ($method === 'DELETE') {
    $year = $_GET['year'] ?? date('Y');
    $stmt = $db->prepare("DELETE FROM bokbad_reading_goals WHERE user_id = ? AND year = ?");
    $stmt->execute([$userId, (int)$year]);
    sendSuccess(['message' => 'Goal deleted']);
} else {
    sendError('Method not allowed', 405);
}
