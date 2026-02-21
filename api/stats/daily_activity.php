<?php
/**
 * Daily activity stats for the dashboard.
 * GET /api/stats/daily_activity.php?days=30
 * Returns per-day reading/listening minutes and a period summary.
 */
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();
$days = isset($_GET['days']) ? max(1, min(90, (int)$_GET['days'])) : 30;

$startDate = date('Y-m-d', strtotime("-{$days} days"));
$endDate = date('Y-m-d');

try {
    // Get daily session data split by format (read vs listen)
    $stmt = $db->prepare("
        SELECT 
            rs.session_date,
            SUM(CASE WHEN b.format = 'audiobook' THEN rs.duration_minutes ELSE 0 END) as listen_minutes,
            SUM(CASE WHEN b.format != 'audiobook' OR b.format IS NULL THEN rs.duration_minutes ELSE 0 END) as read_minutes,
            SUM(COALESCE(rs.pages_read, 0)) as pages
        FROM bokbad_reading_sessions rs
        LEFT JOIN bokbad_books b ON rs.book_id = b.id
        WHERE rs.user_id = ?
          AND rs.session_date BETWEEN ? AND ?
        GROUP BY rs.session_date
        ORDER BY rs.session_date ASC
    ");
    $stmt->execute([$userId, $startDate, $endDate]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build lookup map
    $dataByDate = [];
    foreach ($results as $row) {
        $dataByDate[$row['session_date']] = [
            'readMinutes' => (int)$row['read_minutes'],
            'listenMinutes' => (int)$row['listen_minutes'],
            'pages' => (int)$row['pages']
        ];
    }

    // Fill all days in range
    $dailyData = [];
    $current = new DateTime($startDate);
    $end = new DateTime($endDate);
    $end->modify('+1 day');

    while ($current < $end) {
        $dateStr = $current->format('Y-m-d');
        $dailyData[] = array_merge(
            ['date' => $dateStr],
            $dataByDate[$dateStr] ?? ['readMinutes' => 0, 'listenMinutes' => 0, 'pages' => 0]
        );
        $current->modify('+1 day');
    }

    // Summary stats for the period
    $totalReadMinutes = array_sum(array_column($dailyData, 'readMinutes'));
    $totalListenMinutes = array_sum(array_column($dailyData, 'listenMinutes'));
    $totalPages = array_sum(array_column($dailyData, 'pages'));
    $daysActive = count(array_filter($dailyData, fn($d) => $d['readMinutes'] > 0 || $d['listenMinutes'] > 0));

    // Books started in the period
    $stmt = $db->prepare("
        SELECT COUNT(*) as count
        FROM bokbad_books
        WHERE user_id = ? AND start_date BETWEEN ? AND ?
    ");
    $stmt->execute([$userId, $startDate, $endDate]);
    $booksStarted = (int)$stmt->fetch()['count'];

    // Books finished in the period
    $stmt = $db->prepare("
        SELECT COUNT(*) as count
        FROM bokbad_books
        WHERE user_id = ? AND status = 'read'
          AND finish_date BETWEEN ? AND ?
    ");
    $stmt->execute([$userId, $startDate, $endDate]);
    $booksFinished = (int)$stmt->fetch()['count'];

    sendSuccess([
        'days' => $dailyData,
        'summary' => [
            'totalReadMinutes' => $totalReadMinutes,
            'totalListenMinutes' => $totalListenMinutes,
            'totalPages' => $totalPages,
            'booksStarted' => $booksStarted,
            'booksFinished' => $booksFinished,
            'daysActive' => $daysActive
        ]
    ]);
} catch (PDOException $e) {
    error_log('Daily activity error: ' . $e->getMessage());
    sendError('Failed to load activity data', 500);
}
