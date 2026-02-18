<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

// Handle different HTTP methods
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetBooks($db, $userId);
        break;
    case 'POST':
        handleCreateBook($db, $userId);
        break;
    case 'PUT':
        handleUpdateBook($db, $userId);
        break;
    case 'DELETE':
        handleDeleteBook($db, $userId);
        break;
    default:
        sendError('Method not allowed', 405);
}

// GET all bokbad_books with optional filters
function handleGetBooks($db, $userId) {
    $status = $_GET['status'] ?? null;
    $genre = $_GET['genre'] ?? null;
    $topic = $_GET['topic'] ?? null;
    $search = $_GET['search'] ?? null;
    $isAudiobook = $_GET['isAudiobook'] ?? null;
    
    $query = "SELECT * FROM bokbad_books WHERE user_id = ?";
    $params = [$userId];
    
    // Add status filter
    if ($status && in_array($status, ['want-to-read', 'reading', 'read', 'up-next'])) {
        $query .= " AND status = ?";
        $params[] = $status;
    }
    
    // Add search filter
    if ($search) {
        $query .= " AND (name LIKE ? OR JSON_SEARCH(authors, 'one', ?) IS NOT NULL)";
        $searchTerm = "%{$search}%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }
    
    // Add genre filter
    if ($genre) {
        $query .= " AND JSON_SEARCH(genres, 'one', ?) IS NOT NULL";
        $params[] = $genre;
    }
    
    // Add topic filter
    if ($topic) {
        $query .= " AND JSON_SEARCH(topics, 'one', ?) IS NOT NULL";
        $params[] = $topic;
    }
    
    // Add audiobook filter
    if ($isAudiobook !== null) {
        $query .= " AND is_audiobook = ?";
        $params[] = (int)$isAudiobook;
    }
    
    $query .= " ORDER BY created_at DESC";
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $bokbad_books = $stmt->fetchAll();
    
    // Parse JSON fields
    foreach ($bokbad_books as &$book) {
        $book['authors'] = json_decode($book['authors'] ?? '[]');
        $book['genres'] = json_decode($book['genres'] ?? '[]');
        $book['topics'] = json_decode($book['topics'] ?? '[]');
        $book['id'] = (int)$book['id'];
        $book['user_id'] = (int)$book['user_id'];
        $book['is_audiobook'] = (bool)$book['is_audiobook'];
        $book['format'] = $book['format'] ?? 'paper';
        $book['total_pages'] = $book['total_pages'] ? (int)$book['total_pages'] : null;
        $book['current_page'] = (int)($book['current_page'] ?? 0);
        $book['total_duration_min'] = $book['total_duration_min'] ? (int)$book['total_duration_min'] : null;
        $book['current_duration_min'] = (int)($book['current_duration_min'] ?? 0);
        $book['current_percentage'] = (float)($book['current_percentage'] ?? 0);
        $book['series_id'] = $book['series_id'] ? (int)$book['series_id'] : null;
        $book['series_order'] = $book['series_order'] ? (int)$book['series_order'] : null;
    }
    
    sendSuccess(['books' => $bokbad_books]);
}

// POST create new book
function handleCreateBook($db, $userId) {
    $data = getJsonInput();
    validateRequired($data, ['name', 'status']);
    
    $name = sanitizeString($data['name']);
    $authors = $data['authors'] ?? [];
    $coverImage = $data['coverImage'] ?? null;
    $genres = $data['genres'] ?? [];
    $topics = $data['topics'] ?? [];
    $status = $data['status'];
    $thoughts = $data['thoughts'] ?? null;
    $startDate = $data['startDate'] ?? null;
    $finishDate = $data['finishDate'] ?? null;
    $isbn = $data['isbn'] ?? null;
    $isAudiobook = !empty($data['isAudiobook']) ? 1 : 0;
    $format = $data['format'] ?? ($isAudiobook ? 'audiobook' : 'paper');
    $totalPages = isset($data['totalPages']) ? (int)$data['totalPages'] : null;
    $currentPage = isset($data['currentPage']) ? (int)$data['currentPage'] : 0;
    $totalDurationMin = isset($data['totalDurationMin']) ? (int)$data['totalDurationMin'] : null;
    $currentDurationMin = isset($data['currentDurationMin']) ? (int)$data['currentDurationMin'] : 0;
    $currentPercentage = isset($data['currentPercentage']) ? (float)$data['currentPercentage'] : 0;
    
    // Derive is_audiobook from format
    $isAudiobook = $format === 'audiobook' ? 1 : 0;
    
    // Validate status
    if (!in_array($status, ['want-to-read', 'reading', 'read', 'up-next'])) {
        sendError('Invalid status. Must be: want-to-read, reading, read, or up-next');
    }
    
    // When marking as read, set progress to 100%
    if ($status === 'read') {
        if ($format === 'paper' && $totalPages) {
            $currentPage = $totalPages;
        } elseif ($format === 'ebook') {
            $currentPercentage = 100.0;
        } elseif ($format === 'audiobook' && $totalDurationMin) {
            $currentDurationMin = $totalDurationMin;
        }
    }
    
    // Check if progress is at 100% and auto-mark as read
    $progressAt100 = false;
    if ($format === 'paper' && $totalPages && $currentPage >= $totalPages) {
        $progressAt100 = true;
    } elseif ($format === 'ebook' && $currentPercentage >= 100) {
        $progressAt100 = true;
    } elseif ($format === 'audiobook' && $totalDurationMin && $currentDurationMin >= $totalDurationMin) {
        $progressAt100 = true;
    }
    
    if ($progressAt100 && $status !== 'read') {
        $status = 'read';
    }
    
    // Auto-set finish date if status is 'read' and no date provided
    if ($status === 'read' && !$finishDate) {
        $finishDate = date('Y-m-d');
    }
    
    $seriesId = isset($data['seriesId']) ? (int)$data['seriesId'] : null;
    $seriesOrder = isset($data['seriesOrder']) ? (int)$data['seriesOrder'] : null;
    
    $stmt = $db->prepare("
        INSERT INTO bokbad_books (user_id, name, authors, cover_image, genres, topics, status, thoughts, start_date, finish_date, isbn, is_audiobook, format, total_pages, current_page, total_duration_min, current_duration_min, current_percentage, series_id, series_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $userId,
        $name,
        json_encode($authors),
        $coverImage,
        json_encode($genres),
        json_encode($topics),
        $status,
        $thoughts,
        $startDate,
        $finishDate,
        $isbn,
        $isAudiobook,
        $format,
        $totalPages,
        $currentPage,
        $totalDurationMin,
        $currentDurationMin,
        $currentPercentage,
        $seriesId ?: null,
        $seriesOrder ?: null
    ]);
    
    $bookId = $db->lastInsertId();
    
    // Fetch and return created book
    $stmt = $db->prepare("SELECT * FROM bokbad_books WHERE id = ?");
    $stmt->execute([$bookId]);
    $book = $stmt->fetch();
    
    $book['authors'] = json_decode($book['authors'] ?? '[]');
    $book['genres'] = json_decode($book['genres'] ?? '[]');
    $book['topics'] = json_decode($book['topics'] ?? '[]');
    $book['id'] = (int)$book['id'];
    $book['is_audiobook'] = (bool)$book['is_audiobook'];
    $book['format'] = $book['format'] ?? 'paper';
    $book['total_pages'] = $book['total_pages'] ? (int)$book['total_pages'] : null;
    $book['current_page'] = (int)($book['current_page'] ?? 0);
    $book['total_duration_min'] = $book['total_duration_min'] ? (int)$book['total_duration_min'] : null;
    $book['current_duration_min'] = (int)($book['current_duration_min'] ?? 0);
    $book['current_percentage'] = (float)($book['current_percentage'] ?? 0);
    $book['series_id'] = $book['series_id'] ? (int)$book['series_id'] : null;
    $book['series_order'] = $book['series_order'] ? (int)$book['series_order'] : null;
    
    sendSuccess(['book' => $book], 201);
}

// PUT update book
function handleUpdateBook($db, $userId) {
    $data = getJsonInput();
    validateRequired($data, ['id']);
    
    $bookId = (int)$data['id'];
    
    // Fetch current book data to check format and totals for progress sync
    $stmt = $db->prepare("SELECT * FROM bokbad_books WHERE id = ? AND user_id = ?");
    $stmt->execute([$bookId, $userId]);
    $currentBook = $stmt->fetch();
    if (!$currentBook) {
        sendError('Book not found', 404);
    }
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    
    if (isset($data['name'])) {
        $updates[] = "name = ?";
        $params[] = sanitizeString($data['name']);
    }
    if (isset($data['authors'])) {
        $updates[] = "authors = ?";
        $params[] = json_encode($data['authors']);
    }
    if (isset($data['coverImage'])) {
        $updates[] = "cover_image = ?";
        $params[] = $data['coverImage'];
    }
    if (isset($data['genres'])) {
        $updates[] = "genres = ?";
        $params[] = json_encode($data['genres']);
    }
    if (isset($data['topics'])) {
        $updates[] = "topics = ?";
        $params[] = json_encode($data['topics']);
    }
    if (isset($data['status'])) {
        if (!in_array($data['status'], ['want-to-read', 'reading', 'read', 'up-next'])) {
            sendError('Invalid status');
        }
        $updates[] = "status = ?";
        $params[] = $data['status'];
        
        // Auto-set finish date when marking as read
        if ($data['status'] === 'read' && !isset($data['finishDate'])) {
            $updates[] = "finish_date = ?";
            $params[] = date('Y-m-d');
        }
        
        // NOTE: We intentionally do NOT auto-clear finish_date when moving away from 'read'.
        // Auto-clearing risks destroying historical data (e.g. a book finished in 2022).
        // Users can manually clear the finish date in the edit form if needed.
        
        // When marking as read, set progress to 100%
        if ($data['status'] === 'read') {
            $format = $data['format'] ?? $currentBook['format'] ?? 'paper';
            
            if ($format === 'paper') {
                $totalPages = $data['totalPages'] ?? $currentBook['total_pages'];
                if ($totalPages) {
                    $updates[] = "current_page = ?";
                    $params[] = (int)$totalPages;
                }
            } elseif ($format === 'ebook') {
                $updates[] = "current_percentage = ?";
                $params[] = 100.0;
            } elseif ($format === 'audiobook') {
                $totalDuration = $data['totalDurationMin'] ?? $currentBook['total_duration_min'];
                if ($totalDuration) {
                    $updates[] = "current_duration_min = ?";
                    $params[] = (int)$totalDuration;
                }
            }
        }
    }
    if (isset($data['thoughts'])) {
        $updates[] = "thoughts = ?";
        $params[] = $data['thoughts'];
    }
    if (array_key_exists('startDate', $data)) {
        $updates[] = "start_date = ?";
        $params[] = $data['startDate'] ?: null;
    }
    if (array_key_exists('finishDate', $data)) {
        $updates[] = "finish_date = ?";
        $params[] = $data['finishDate'] ?: null;
    }
    if (isset($data['isbn'])) {
        $updates[] = "isbn = ?";
        $params[] = $data['isbn'];
    }
    if (isset($data['isAudiobook'])) {
        $updates[] = "is_audiobook = ?";
        $params[] = !empty($data['isAudiobook']) ? 1 : 0;
    }
    if (isset($data['format'])) {
        $updates[] = "format = ?";
        $params[] = $data['format'];
        // Sync is_audiobook
        $updates[] = "is_audiobook = ?";
        $params[] = $data['format'] === 'audiobook' ? 1 : 0;
    }
    if (isset($data['totalPages'])) {
        $updates[] = "total_pages = ?";
        $params[] = $data['totalPages'] ? (int)$data['totalPages'] : null;
    }
    if (isset($data['currentPage'])) {
        $updates[] = "current_page = ?";
        $params[] = (int)$data['currentPage'];
    }
    if (isset($data['totalDurationMin'])) {
        $updates[] = "total_duration_min = ?";
        $params[] = $data['totalDurationMin'] ? (int)$data['totalDurationMin'] : null;
    }
    if (isset($data['currentDurationMin'])) {
        $updates[] = "current_duration_min = ?";
        $params[] = (int)$data['currentDurationMin'];
    }
    if (isset($data['currentPercentage'])) {
        $updates[] = "current_percentage = ?";
        $params[] = (float)$data['currentPercentage'];
    }
    if (array_key_exists('seriesId', $data)) {
        $updates[] = "series_id = ?";
        $params[] = $data['seriesId'] ? (int)$data['seriesId'] : null;
    }
    if (isset($data['seriesOrder'])) {
        $updates[] = "series_order = ?";
        $params[] = (int)$data['seriesOrder'];
    }
    
    // Check if progress has reached 100% and auto-mark as read
    // Only do this if the user didn't explicitly set a status
    if (!isset($data['status'])) {
        $format = $data['format'] ?? $currentBook['format'] ?? 'paper';
        $currentStatus = $currentBook['status'];
    
        if ($currentStatus !== 'read') {
            $progressAt100 = false;
            
            if ($format === 'paper') {
                $currentPage = $data['currentPage'] ?? $currentBook['current_page'];
                $totalPages = $data['totalPages'] ?? $currentBook['total_pages'];
                if ($totalPages && $currentPage >= $totalPages) {
                    $progressAt100 = true;
                }
            } elseif ($format === 'ebook') {
                $currentPercentage = $data['currentPercentage'] ?? $currentBook['current_percentage'];
                if ($currentPercentage >= 100) {
                    $progressAt100 = true;
                }
            } elseif ($format === 'audiobook') {
                $currentDuration = $data['currentDurationMin'] ?? $currentBook['current_duration_min'];
                $totalDuration = $data['totalDurationMin'] ?? $currentBook['total_duration_min'];
                if ($totalDuration && $currentDuration >= $totalDuration) {
                    $progressAt100 = true;
                }
            }
            
            if ($progressAt100) {
                $updates[] = "status = ?";
                $params[] = 'read';
                
                // Auto-set finish date if not already set
                if (!isset($data['finishDate']) && !$currentBook['finish_date']) {
                    $updates[] = "finish_date = ?";
                    $params[] = date('Y-m-d');
                }
            }
        }
    }
    
    if (empty($updates)) {
        sendError('No fields to update');
    }
    
    $params[] = $bookId;
    $params[] = $userId;
    
    $query = "UPDATE bokbad_books SET " . implode(', ', $updates) . " WHERE id = ? AND user_id = ?";
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    
    // Fetch and return updated book
    $stmt = $db->prepare("SELECT * FROM bokbad_books WHERE id = ?");
    $stmt->execute([$bookId]);
    $book = $stmt->fetch();
    
    $book['authors'] = json_decode($book['authors'] ?? '[]');
    $book['genres'] = json_decode($book['genres'] ?? '[]');
    $book['topics'] = json_decode($book['topics'] ?? '[]');
    $book['id'] = (int)$book['id'];
    $book['is_audiobook'] = (bool)$book['is_audiobook'];
    $book['format'] = $book['format'] ?? 'paper';
    $book['total_pages'] = $book['total_pages'] ? (int)$book['total_pages'] : null;
    $book['current_page'] = (int)($book['current_page'] ?? 0);
    $book['total_duration_min'] = $book['total_duration_min'] ? (int)$book['total_duration_min'] : null;
    $book['current_duration_min'] = (int)($book['current_duration_min'] ?? 0);
    $book['current_percentage'] = (float)($book['current_percentage'] ?? 0);
    $book['series_id'] = $book['series_id'] ? (int)$book['series_id'] : null;
    $book['series_order'] = $book['series_order'] ? (int)$book['series_order'] : null;
    
    sendSuccess(['book' => $book]);
}

// DELETE book
function handleDeleteBook($db, $userId) {
    $bookId = $_GET['id'] ?? null;
    
    if (!$bookId) {
        sendError('Book ID required');
    }
    
    // Get book to delete cover image
    $stmt = $db->prepare("SELECT cover_image FROM bokbad_books WHERE id = ? AND user_id = ?");
    $stmt->execute([$bookId, $userId]);
    $book = $stmt->fetch();
    
    if (!$book) {
        sendError('Book not found', 404);
    }
    
    // Delete cover image if exists
    if ($book['cover_image']) {
        require_once __DIR__ . '/../utils/image_processor.php';
        ImageProcessor::deleteImage($book['cover_image']);
    }
    
    // Delete book
    $stmt = $db->prepare("DELETE FROM bokbad_books WHERE id = ? AND user_id = ?");
    $stmt->execute([$bookId, $userId]);
    
    sendSuccess(['message' => 'Book deleted successfully']);
}
