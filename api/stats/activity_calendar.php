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

$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('n');

// Clamp month to 1-12
$month = max(1, min(12, $month));

try {
    // Get all session dates and page counts for the month
    $stmt = $db->prepare("
        SELECT session_date, 
               SUM(pages_read) as total_pages,
               SUM(duration_minutes) as total_minutes,
               COUNT(*) as session_count
        FROM bokbad_reading_sessions 
        WHERE user_id = ? 
          AND YEAR(session_date) = ?
          AND MONTH(session_date) = ?
        GROUP BY session_date
        ORDER BY session_date
    ");
    $stmt->execute([$userId, $year, $month]);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build a map of date => data
    $sessionMap = [];
    foreach ($sessions as $s) {
        $sessionMap[$s['session_date']] = [
            'pages' => (int)$s['total_pages'],
            'minutes' => (int)$s['total_minutes'],
            'sessions' => (int)$s['session_count']
        ];
    }

    // Get total sessions this month
    $totalSessions = array_sum(array_column($sessions, 'session_count'));
    $totalDaysRead = count($sessions);

    // Get current streak (reuse logic)
    $stmt = $db->prepare("
        SELECT DISTINCT session_date 
        FROM bokbad_reading_sessions 
        WHERE user_id = ? 
        ORDER BY session_date DESC 
        LIMIT 365
    ");
    $stmt->execute([$userId]);
    $allDates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $streak = 0;
    $checkDate = new DateTime();
    $checkStr = $checkDate->format('Y-m-d');
    if (!in_array($checkStr, $allDates)) {
        $checkDate->modify('-1 day');
        $checkStr = $checkDate->format('Y-m-d');
    }
    foreach ($allDates as $date) {
        if ($date === $checkStr) {
            $streak++;
            $checkDate->modify('-1 day');
            $checkStr = $checkDate->format('Y-m-d');
        } else {
            break;
        }
    }

    sendSuccess([
        'year' => $year,
        'month' => $month,
        'sessions' => $sessionMap,
        'totalSessions' => $totalSessions,
        'daysRead' => $totalDaysRead,
        'streak' => $streak
    ]);
} catch (PDOException $e) {
    sendError('Failed to load calendar data', 500);
}
