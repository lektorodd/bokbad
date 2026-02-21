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

// Get all genres, topics, and authors from user's books (compatible with MySQL 5.7+)
$stmt = $db->prepare("SELECT genres, topics, authors FROM bokbad_books WHERE user_id = ?");
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

$genres = [];
$topics = [];
$authors = [];

foreach ($rows as $row) {
    $bookGenres = json_decode($row['genres'] ?? '[]', true);
    if (is_array($bookGenres)) {
        foreach ($bookGenres as $g) {
            $gNorm = strtolower(trim($g));
            if ($gNorm && !in_array($gNorm, $genres)) {
                $genres[] = $gNorm;
            }
        }
    }
    
    $bookTopics = json_decode($row['topics'] ?? '[]', true);
    if (is_array($bookTopics)) {
        foreach ($bookTopics as $t) {
            $tLower = strtolower(trim($t));
            $existingLower = array_map('strtolower', $topics);
            if ($t && !in_array($tLower, $existingLower)) {
                $topics[] = $t;
            }
        }
    }

    $bookAuthors = json_decode($row['authors'] ?? '[]', true);
    if (is_array($bookAuthors)) {
        foreach ($bookAuthors as $a) {
            if ($a && !in_array($a, $authors)) {
                $authors[] = $a;
            }
        }
    }
}

sort($genres);
sort($topics);
sort($authors);

sendSuccess(['genres' => $genres, 'topics' => $topics, 'authors' => $authors]);
