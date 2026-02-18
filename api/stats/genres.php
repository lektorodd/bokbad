<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

// Get genre breakdown for finished books
$stmt = $db->prepare("SELECT genres FROM bokbad_books WHERE user_id = ? AND status = 'read'");
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

$genreCounts = [];
$topicCounts = [];

foreach ($rows as $row) {
    $genres = json_decode($row['genres'] ?? '[]', true);
    if (is_array($genres)) {
        foreach ($genres as $g) {
            if ($g) {
                $key = strtolower(trim($g));
                $genreCounts[$key] = ($genreCounts[$key] ?? 0) + 1;
            }
        }
    }
}

// Get topic breakdown for finished books
$stmt = $db->prepare("SELECT topics FROM bokbad_books WHERE user_id = ? AND status = 'read'");
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

foreach ($rows as $row) {
    $topics = json_decode($row['topics'] ?? '[]', true);
    if (is_array($topics)) {
        foreach ($topics as $t) {
            if ($t) {
                $topicCounts[$t] = ($topicCounts[$t] ?? 0) + 1;
            }
        }
    }
}

// Sort by count descending
arsort($genreCounts);
arsort($topicCounts);

// Convert to arrays for JSON
$genreBreakdown = [];
foreach ($genreCounts as $name => $count) {
    $genreBreakdown[] = ['name' => $name, 'count' => $count];
}

$topicBreakdown = [];
foreach ($topicCounts as $name => $count) {
    $topicBreakdown[] = ['name' => $name, 'count' => $count];
}

sendSuccess([
    'genres' => $genreBreakdown,
    'topics' => $topicBreakdown
]);
