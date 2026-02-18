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

$numDays = isset($_GET['days']) ? min(30, max(1, (int)$_GET['days'])) : 10;

try {
    // Get distinct session dates for the last N days
    $stmt = $db->prepare("
        SELECT DISTINCT session_date 
        FROM bokbad_reading_sessions 
        WHERE user_id = ? 
          AND session_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY session_date DESC
    ");
    $stmt->execute([$userId, $numDays]);
    $sessionDates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Build the days array (today → N days ago)
    $days = [];
    $today = new DateTime();
    for ($i = 0; $i < $numDays; $i++) {
        $date = clone $today;
        $date->modify("-{$i} day");
        $dateStr = $date->format('Y-m-d');
        $days[] = [
            'date' => $dateStr,
            'read' => in_array($dateStr, $sessionDates)
        ];
    }
    // Reverse so chronological order (oldest first, today last)
    $days = array_reverse($days);

    // Calculate current streak
    $streak = 0;
    $checkDate = new DateTime();
    $checkStr = $checkDate->format('Y-m-d');

    // If today has no session, check from yesterday
    if (!in_array($checkStr, $sessionDates)) {
        $checkDate->modify('-1 day');
        $checkStr = $checkDate->format('Y-m-d');
    }

    // Need all session dates for full streak calculation (might be longer than N days)
    $stmt = $db->prepare("
        SELECT DISTINCT session_date 
        FROM bokbad_reading_sessions 
        WHERE user_id = ? 
        ORDER BY session_date DESC 
        LIMIT 365
    ");
    $stmt->execute([$userId]);
    $allDates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($allDates as $date) {
        if ($date === $checkStr) {
            $streak++;
            $checkDate->modify('-1 day');
            $checkStr = $checkDate->format('Y-m-d');
        } else {
            break;
        }
    }

    // Determine if today was a reading day
    $todayRead = in_array((new DateTime())->format('Y-m-d'), $sessionDates);

    sendSuccess([
        'days' => $days,
        'streak' => $streak,
        'todayRead' => $todayRead
    ]);
} catch (PDOException $e) {
    sendSuccess([
        'days' => [],
        'streak' => 0,
        'todayRead' => false
    ]);
}
