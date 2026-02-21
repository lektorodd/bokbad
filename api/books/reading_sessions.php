<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

$userId = getCurrentUserId();
$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getInstance()->getConnection();

switch ($method) {
    case 'GET':
        handleGetSessions($db, $userId);
        break;
    case 'POST':
        handleCreateSession($db, $userId);
        break;
    case 'DELETE':
        handleDeleteSession($db, $userId);
        break;
    default:
        sendError('Method not allowed', 405);
}

// GET reading sessions — optionally filtered by book_id
function handleGetSessions($db, $userId) {
    try {
        $bookId = $_GET['book_id'] ?? null;

        if ($bookId) {
            $stmt = $db->prepare(
                "SELECT * FROM bokbad_reading_sessions WHERE user_id = ? AND book_id = ? ORDER BY session_date DESC"
            );
            $stmt->execute([$userId, (int)$bookId]);
        } else {
            $stmt = $db->prepare(
                "SELECT * FROM bokbad_reading_sessions WHERE user_id = ? ORDER BY session_date DESC"
            );
            $stmt->execute([$userId]);
        }

        $sessions = $stmt->fetchAll();

        // Cast types
        foreach ($sessions as &$s) {
            $s['id'] = (int)$s['id'];
            $s['book_id'] = (int)$s['book_id'];
            $s['pages_read'] = (int)$s['pages_read'];
            $s['duration_minutes'] = $s['duration_minutes'] ? (int)$s['duration_minutes'] : null;
        }

        sendSuccess(['sessions' => $sessions]);
    } catch (PDOException $e) {
        // Table might not exist yet
        sendSuccess(['sessions' => []]);
    }
}

// POST create new session + auto-update book progress based on format
function handleCreateSession($db, $userId) {
    $data = getJsonInput();

    if (!isset($data['book_id'])) {
        sendError('Missing required field: book_id', 400);
    }

    $bookId = (int)$data['book_id'];
    $date = $data['session_date'] ?? date('Y-m-d');
    $duration = isset($data['duration_minutes']) ? (int)$data['duration_minutes'] : null;
    $notes = $data['notes'] ?? null;

    // Verify book belongs to user and get format info
    $stmt = $db->prepare("SELECT id, format, current_page, total_pages, current_duration_min, total_duration_min, current_percentage FROM bokbad_books WHERE id = ? AND user_id = ?");
    $stmt->execute([$bookId, $userId]);
    $book = $stmt->fetch();

    if (!$book) {
        sendError('Book not found', 404);
    }

    $format = $book['format'] ?? 'paper';

    // pages_read is used for paper books, but we store it for all formats as the primary metric
    $pagesRead = isset($data['pages_read']) ? (int)$data['pages_read'] : 0;
    $percentage = isset($data['percentage']) ? (float)$data['percentage'] : null;

    try {
        $db->beginTransaction();

        // Insert session
        $stmt = $db->prepare("
            INSERT INTO bokbad_reading_sessions (user_id, book_id, session_date, pages_read, duration_minutes, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $bookId, $date, $pagesRead, $duration, $notes]);
        $sessionId = $db->lastInsertId();

        // Auto-update book progress based on format
        $response = ['session_id' => (int)$sessionId];
        $progressAt100 = false;

        switch ($format) {
            case 'paper':
                // pages_read is the absolute page number the user is now on
                $currentPage = (int)$book['current_page'];
                $totalPages = $book['total_pages'] ? (int)$book['total_pages'] : null;
                // Only update if the new page is ahead of current
                $newPage = $pagesRead > $currentPage ? $pagesRead : $currentPage;
                if ($totalPages && $newPage > $totalPages) {
                    $newPage = $totalPages;
                }
                if ($newPage !== $currentPage) {
                    $stmt = $db->prepare("UPDATE bokbad_books SET current_page = ? WHERE id = ? AND user_id = ?");
                    $stmt->execute([$newPage, $bookId, $userId]);
                }
                $response['current_page'] = $newPage;
                
                // Check if progress reached 100% — only if it JUST reached 100%
                if ($totalPages && $newPage >= $totalPages && $currentPage < $totalPages) {
                    $progressAt100 = true;
                }
                break;

            case 'audiobook':
                // duration_minutes is the absolute position in the audiobook
                $currentDuration = (int)$book['current_duration_min'];
                $totalDuration = $book['total_duration_min'] ? (int)$book['total_duration_min'] : null;

                if ($duration) {
                    // Treat as absolute position if larger than current, else add as increment
                    $newDuration = $duration > $currentDuration ? $duration : $currentDuration + $duration;
                    if ($totalDuration && $newDuration > $totalDuration) {
                        $newDuration = $totalDuration;
                    }

                    // Calculate the actual listening delta for this session
                    $sessionDelta = $newDuration - $currentDuration;
                    if ($sessionDelta < 0) $sessionDelta = 0;

                    // Update the session record with the delta (not absolute position)
                    // so that stats correctly sum session increments
                    $stmt = $db->prepare("UPDATE bokbad_reading_sessions SET duration_minutes = ? WHERE id = ?");
                    $stmt->execute([$sessionDelta, $sessionId]);

                    $stmt = $db->prepare("UPDATE bokbad_books SET current_duration_min = ? WHERE id = ? AND user_id = ?");
                    $stmt->execute([$newDuration, $bookId, $userId]);
                    $response['current_duration_min'] = $newDuration;
                    
                    // Check if progress reached 100%
                    if ($totalDuration && $newDuration >= $totalDuration) {
                        $progressAt100 = true;
                    }
                }
                break;

            case 'ebook':
                // percentage is a direct 0-100 value
                if ($percentage !== null) {
                    $newPct = min(100, max(0, $percentage));
                    $stmt = $db->prepare("UPDATE bokbad_books SET current_percentage = ? WHERE id = ? AND user_id = ?");
                    $stmt->execute([$newPct, $bookId, $userId]);
                    $response['current_percentage'] = $newPct;
                    
                    // Check if progress reached 100%
                    if ($newPct >= 100) {
                        $progressAt100 = true;
                    }
                }
                break;
        }
        
        // If progress reached 100%, auto-mark as read
        if ($progressAt100) {
            $stmt = $db->prepare("SELECT status, finish_date FROM bokbad_books WHERE id = ?");
            $stmt->execute([$bookId]);
            $bookStatus = $stmt->fetch();
            
            if ($bookStatus && $bookStatus['status'] !== 'read') {
                $finishDate = $bookStatus['finish_date'] ?: date('Y-m-d');
                $stmt = $db->prepare("UPDATE bokbad_books SET status = 'read', finish_date = ? WHERE id = ? AND user_id = ?");
                $stmt->execute([$finishDate, $bookId, $userId]);
                $response['status_updated'] = 'read';
            }
        }

        $db->commit();

        // Return created session
        $stmt = $db->prepare("SELECT * FROM bokbad_reading_sessions WHERE id = ?");
        $stmt->execute([$sessionId]);
        $session = $stmt->fetch();

        $session['id'] = (int)$session['id'];
        $session['book_id'] = (int)$session['book_id'];
        $session['pages_read'] = (int)$session['pages_read'];
        $session['duration_minutes'] = $session['duration_minutes'] ? (int)$session['duration_minutes'] : null;

        $response['session'] = $session;
        sendSuccess($response, 201);
    } catch (PDOException $e) {
        $db->rollBack();
        error_log('Reading session error: ' . $e->getMessage());
        sendError('Failed to save reading session', 500);
    }
}

// DELETE a reading session
function handleDeleteSession($db, $userId) {
    $sessionId = $_GET['id'] ?? null;

    if (!$sessionId) {
        sendError('Session ID required', 400);
    }

    // Verify session belongs to user
    $stmt = $db->prepare("SELECT id FROM bokbad_reading_sessions WHERE id = ? AND user_id = ?");
    $stmt->execute([(int)$sessionId, $userId]);

    if (!$stmt->fetch()) {
        sendError('Session not found', 404);
    }

    $stmt = $db->prepare("DELETE FROM bokbad_reading_sessions WHERE id = ? AND user_id = ?");
    $stmt->execute([(int)$sessionId, $userId]);

    sendSuccess(['message' => 'Session deleted']);
}
