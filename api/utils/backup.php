<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Export all user data
    
    // Books
    $stmt = $db->prepare("SELECT * FROM bokbad_books WHERE user_id = ?");
    $stmt->execute([$userId]);
    $books = $stmt->fetchAll();

    // Reading sessions
    $sessions = [];
    try {
        $stmt = $db->prepare("SELECT * FROM bokbad_reading_sessions WHERE user_id = ?");
        $stmt->execute([$userId]);
        $sessions = $stmt->fetchAll();
    } catch (PDOException $e) {}

    // Goals
    $goals = [];
    try {
        $stmt = $db->prepare("SELECT * FROM bokbad_reading_goals WHERE user_id = ?");
        $stmt->execute([$userId]);
        $goals = $stmt->fetchAll();
    } catch (PDOException $e) {}

    // Series
    $series = [];
    try {
        $stmt = $db->prepare("SELECT * FROM bokbad_series WHERE user_id = ?");
        $stmt->execute([$userId]);
        $series = $stmt->fetchAll();
    } catch (PDOException $e) {}

    $export = [
        'version' => 1,
        'exportDate' => date('c'),
        'books' => $books,
        'sessions' => $sessions,
        'goals' => $goals,
        'series' => $series,
    ];

    sendSuccess(['data' => $export]);

} elseif ($method === 'POST') {
    // Import user data
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data || !isset($data['books'])) {
        sendError('Invalid backup data');
    }

    $imported = ['books' => 0, 'sessions' => 0, 'goals' => 0, 'series' => 0];

    try {
        $db->beginTransaction();

        // Import series first (books may reference them)
        if (!empty($data['series'])) {
            $seriesIdMap = []; // old_id => new_id
            foreach ($data['series'] as $s) {
                $stmt = $db->prepare("INSERT INTO bokbad_series (user_id, name, total_books) VALUES (?, ?, ?)");
                $stmt->execute([$userId, $s['name'], $s['total_books'] ?? null]);
                $seriesIdMap[$s['id']] = $db->lastInsertId();
                $imported['series']++;
            }
        }

        // Import books
        $bookIdMap = []; // old_id => new_id
        foreach ($data['books'] as $book) {
            // Check if book already exists (by name + authors match)
            $stmt = $db->prepare("SELECT id FROM bokbad_books WHERE user_id = ? AND name = ? AND authors = ?");
            $stmt->execute([$userId, $book['name'], $book['authors']]);
            $existing = $stmt->fetch();
            
            if ($existing) {
                $bookIdMap[$book['id']] = $existing['id'];
                continue; // Skip duplicates
            }

            $seriesId = null;
            if (!empty($book['series_id']) && isset($seriesIdMap[$book['series_id']])) {
                $seriesId = $seriesIdMap[$book['series_id']];
            }

            $stmt = $db->prepare("
                INSERT INTO bokbad_books 
                (user_id, name, authors, status, isbn, genres, topics, cover_image, thoughts, 
                 start_date, finish_date, total_pages, format, is_audiobook, 
                 total_duration_min, current_page, current_duration_min, current_percentage,
                 series_id, series_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $book['name'],
                $book['authors'],
                $book['status'] ?? 'want-to-read',
                $book['isbn'] ?? null,
                $book['genres'] ?? '[]',
                $book['topics'] ?? '[]',
                $book['cover_image'] ?? null,
                $book['thoughts'] ?? null,
                $book['start_date'] ?? null,
                $book['finish_date'] ?? null,
                $book['total_pages'] ?? null,
                $book['format'] ?? 'paper',
                $book['is_audiobook'] ?? 0,
                $book['total_duration_min'] ?? null,
                $book['current_page'] ?? 0,
                $book['current_duration_min'] ?? 0,
                $book['current_percentage'] ?? 0,
                $seriesId,
                $book['series_order'] ?? null,
            ]);
            $bookIdMap[$book['id']] = $db->lastInsertId();
            $imported['books']++;
        }

        // Import sessions
        if (!empty($data['sessions'])) {
            foreach ($data['sessions'] as $session) {
                $bookId = $bookIdMap[$session['book_id']] ?? null;
                if (!$bookId) continue;

                $stmt = $db->prepare("
                    INSERT INTO bokbad_reading_sessions 
                    (user_id, book_id, session_date, pages_read, duration_minutes, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $userId,
                    $bookId,
                    $session['session_date'],
                    $session['pages_read'] ?? 0,
                    $session['duration_minutes'] ?? $session['duration_min'] ?? null,
                    $session['notes'] ?? null,
                ]);
                $imported['sessions']++;
            }
        }

        // Import goals
        if (!empty($data['goals'])) {
            foreach ($data['goals'] as $goal) {
                $stmt = $db->prepare("
                    INSERT INTO bokbad_reading_goals (user_id, year, target_books, target_pages)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE target_books = VALUES(target_books), target_pages = VALUES(target_pages)
                ");
                $stmt->execute([
                    $userId,
                    $goal['year'],
                    $goal['target_books'] ?? null,
                    $goal['target_pages'] ?? null,
                ]);
                $imported['goals']++;
            }
        }

        $db->commit();
        sendSuccess(['imported' => $imported]);

    } catch (Exception $e) {
        $db->rollBack();
        error_log('Backup import error: ' . $e->getMessage());
        sendError('Import failed — check server logs for details');
    }

} else {
    sendError('Method not allowed', 405);
}
