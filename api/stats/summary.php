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

function parseIsoDate($value, $fieldName) {
    if ($value === null || $value === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        sendError("Invalid {$fieldName} date format. Use YYYY-MM-DD.", 400);
    }
    [$year, $month, $day] = array_map('intval', explode('-', $value));
    if (!checkdate($month, $day, $year)) {
        sendError("Invalid {$fieldName} date.", 400);
    }
    return $value;
}

// Optional date range filtering
$from = parseIsoDate($_GET['from'] ?? null, 'from');
$to = parseIsoDate($_GET['to'] ?? null, 'to');

if ($from && $to && $from > $to) {
    sendError('Invalid date range: from must be before to', 400);
}

// Build date condition for finish_date filtering
$dateCondition = '';
$dateParams = [];
if ($from && $to) {
    $dateCondition = ' AND finish_date BETWEEN ? AND ?';
    $dateParams = [$from, $to];
} elseif ($from) {
    $dateCondition = ' AND finish_date >= ?';
    $dateParams = [$from];
}

// Get summary stats — status counts always show current state (unfiltered)
$stmt = $db->prepare("
    SELECT 
        status,
        COUNT(*) as count
    FROM bokbad_books
    WHERE user_id = ?
    GROUP BY status
");
$stmt->execute([$userId]);
$results = $stmt->fetchAll();

$stats = [
    'wantToRead' => 0,
    'upNext' => 0,
    'reading' => 0,
    'read' => 0,
    'totalBooks' => 0
];

foreach ($results as $row) {
    $count = (int)$row['count'];
    $stats['totalBooks'] += $count;
    
    switch ($row['status']) {
        case 'want-to-read':
            $stats['wantToRead'] = $count;
            break;
        case 'up-next':
            $stats['upNext'] = $count;
            break;
        case 'reading':
            $stats['reading'] = $count;
            break;
        case 'read':
            $stats['read'] = $count;
            break;
    }
}

// If filtering by date, override 'read' count with filtered count
if ($dateCondition) {
    $stmt = $db->prepare("
        SELECT COUNT(*) as count
        FROM bokbad_books
        WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL" . $dateCondition
    );
    $stmt->execute(array_merge([$userId], $dateParams));
    $stats['read'] = (int)$stmt->fetch()['count'];
}

// Total pages from finished books (filtered)
$stmt = $db->prepare("
    SELECT COALESCE(SUM(total_pages), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND total_pages IS NOT NULL" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$row = $stmt->fetch();
$stats['totalPages'] = (int)$row['total'];

// Average days to finish (filtered)
$stmt = $db->prepare("
    SELECT AVG(DATEDIFF(finish_date, start_date)) as avg_days
    FROM bokbad_books
    WHERE user_id = ?
        AND status = 'read'
        AND finish_date IS NOT NULL
        AND start_date IS NOT NULL
        AND finish_date >= start_date" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$row = $stmt->fetch();
$stats['avgDaysToFinish'] = $row['avg_days'] ? round((float)$row['avg_days'], 1) : null;

// Total listening minutes from finished audiobooks (filtered)
$stmt = $db->prepare("
    SELECT COALESCE(SUM(total_duration_min), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND format = 'audiobook'
        AND total_duration_min IS NOT NULL" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$row = $stmt->fetch();
$stats['totalListeningMinutes'] = (int)$row['total'];

sendSuccess(['stats' => $stats]);
