<?php
/**
 * Unified dashboard statistics endpoint.
 * GET /api/stats/dashboard_stats.php?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 
 * Returns all dashboard metrics from consistent data sources:
 * - Book counts (from bokbad_books)
 * - Pages/time stats (from bokbad_reading_sessions)
 * - Streak (from bokbad_reading_sessions, always current)
 * - Daily breakdown (for charting)
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

$from = parseIsoDate($_GET['from'] ?? null, 'from');
$to = parseIsoDate($_GET['to'] ?? null, 'to');

if ($from && $to && $from > $to) {
    sendError('Invalid date range: from must be before to', 400);
}

// --- Book counts (status pills) ---
// Status counts are always unfiltered (current state)
$stmt = $db->prepare("
    SELECT status, COUNT(*) as count
    FROM bokbad_books
    WHERE user_id = ?
    GROUP BY status
");
$stmt->execute([$userId]);
$results = $stmt->fetchAll();

$counts = [
    'wantToRead' => 0,
    'upNext' => 0,
    'reading' => 0,
    'read' => 0
];
foreach ($results as $row) {
    switch ($row['status']) {
        case 'want-to-read': $counts['wantToRead'] = (int)$row['count']; break;
        case 'up-next':      $counts['upNext'] = (int)$row['count']; break;
        case 'reading':      $counts['reading'] = (int)$row['count']; break;
        case 'read':         $counts['read'] = (int)$row['count']; break;
    }
}

// If filtering, override 'read' with filtered count
$dateCondition = '';
$dateParams = [];
if ($from && $to) {
    $dateCondition = ' AND finish_date BETWEEN ? AND ?';
    $dateParams = [$from, $to];
} elseif ($from) {
    $dateCondition = ' AND finish_date >= ?';
    $dateParams = [$from];
}

if ($dateCondition) {
    $stmt = $db->prepare("
        SELECT COUNT(*) as count FROM bokbad_books
        WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL" . $dateCondition
    );
    $stmt->execute(array_merge([$userId], $dateParams));
    $counts['read'] = (int)$stmt->fetch()['count'];
}

// --- Session-based stats (reading time + in-progress audiobook listening) ---
$sessionCondition = '';
$sessionParams = [];
if ($from && $to) {
    $sessionCondition = ' AND rs.session_date BETWEEN ? AND ?';
    $sessionParams = [$from, $to];
} elseif ($from) {
    $sessionCondition = ' AND rs.session_date >= ?';
    $sessionParams = [$from];
}

// Reading time (paper/ebook) from sessions
$stmt = $db->prepare("
    SELECT
        COALESCE(SUM(CASE WHEN b.format != 'audiobook' OR b.format IS NULL THEN rs.duration_minutes ELSE 0 END), 0) as read_minutes
    FROM bokbad_reading_sessions rs
    LEFT JOIN bokbad_books b ON rs.book_id = b.id
    WHERE rs.user_id = ?" . $sessionCondition
);
$stmt->execute(array_merge([$userId], $sessionParams));
$readMinutes = (int)$stmt->fetch()['read_minutes'];

// Audiobook listening from sessions — only for audiobooks NOT marked as finished
// (finished audiobooks use book-level total_duration_min to avoid double-counting)
$stmt = $db->prepare("
    SELECT COALESCE(SUM(rs.duration_minutes), 0) as listen_minutes
    FROM bokbad_reading_sessions rs
    LEFT JOIN bokbad_books b ON rs.book_id = b.id
    WHERE rs.user_id = ? AND b.format = 'audiobook'
        AND b.status != 'read'" . $sessionCondition
);
$stmt->execute(array_merge([$userId], $sessionParams));
$inProgressListenMinutes = (int)$stmt->fetch()['listen_minutes'];

// --- Book-level stats (filtered by finish_date) ---
// Total pages from finished books
$stmt = $db->prepare("
    SELECT COALESCE(SUM(total_pages), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND total_pages IS NOT NULL" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$totalPages = (int)$stmt->fetch()['total'];

// Total listening minutes from finished audiobooks (book-level total_duration_min)
$stmt = $db->prepare("
    SELECT COALESCE(SUM(total_duration_min), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND format = 'audiobook'
        AND total_duration_min IS NOT NULL" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$bookListenMinutes = (int)$stmt->fetch()['total'];

// Combine: finished audiobook totals + in-progress audiobook sessions
$listenMinutes = $bookListenMinutes + $inProgressListenMinutes;

// --- Avg days to finish (from books, filtered) ---
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
$avgDaysToFinish = $row['avg_days'] ? round((float)$row['avg_days'], 1) : null;

// --- Books per month ---
if ($from && $to) {
    $d1 = new DateTime($from);
    $d2 = new DateTime($to);
    $months = max(1, $d1->diff($d2)->m + $d1->diff($d2)->y * 12);
} elseif ($from) {
    $d1 = new DateTime($from);
    $d2 = new DateTime();
    $months = max(1, $d1->diff($d2)->m + $d1->diff($d2)->y * 12);
} else {
    // All time: use months since first finished book
    $stmt = $db->prepare("
        SELECT MIN(finish_date) as first_finish
        FROM bokbad_books
        WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
    ");
    $stmt->execute([$userId]);
    $firstFinish = $stmt->fetch()['first_finish'];
    if ($firstFinish) {
        $d1 = new DateTime($firstFinish);
        $d2 = new DateTime();
        $months = max(1, $d1->diff($d2)->m + $d1->diff($d2)->y * 12);
    } else {
        $months = 1;
    }
}
$booksPerMonth = round($counts['read'] / $months, 1);

// --- Reading streak (always current, not filtered) ---
$streak = 0;
try {
    $stmt = $db->prepare("
        SELECT DISTINCT session_date
        FROM bokbad_reading_sessions
        WHERE user_id = ?
        ORDER BY session_date DESC
        LIMIT 365
    ");
    $stmt->execute([$userId]);
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $today = new DateTime();
    $checkDate = $today->format('Y-m-d');

    if (!in_array($checkDate, $dates)) {
        $today->modify('-1 day');
        $checkDate = $today->format('Y-m-d');
    }

    foreach ($dates as $date) {
        if ($date === $checkDate) {
            $streak++;
            $today->modify('-1 day');
            $checkDate = $today->format('Y-m-d');
        } else {
            break;
        }
    }
} catch (PDOException $e) {
    $streak = 0;
}

// --- Daily breakdown (for charting) ---
$daily = [];
if ($from && $to) {
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
    $stmt->execute([$userId, $from, $to]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $dataByDate = [];
    foreach ($results as $row) {
        $dataByDate[$row['session_date']] = [
            'readMinutes' => (int)$row['read_minutes'],
            'listenMinutes' => (int)$row['listen_minutes'],
            'pages' => (int)$row['pages']
        ];
    }

    $current = new DateTime($from);
    $end = new DateTime($to);
    $end->modify('+1 day');

    while ($current < $end) {
        $dateStr = $current->format('Y-m-d');
        $daily[] = array_merge(
            ['date' => $dateStr],
            $dataByDate[$dateStr] ?? ['readMinutes' => 0, 'listenMinutes' => 0, 'pages' => 0]
        );
        $current->modify('+1 day');
    }
}

// --- Build response ---
sendSuccess([
    'counts' => $counts,
    'totalPages' => $totalPages,
    'readMinutes' => $readMinutes,
    'listenMinutes' => $listenMinutes,
    'avgDaysToFinish' => $avgDaysToFinish,
    'booksPerMonth' => $booksPerMonth,
    'streak' => $streak,
    'daily' => $daily
]);
