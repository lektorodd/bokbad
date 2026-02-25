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

$dateCondition = '';
$dateParams = [];
if ($from && $to) {
    $dateCondition = ' AND finish_date BETWEEN ? AND ?';
    $dateParams = [$from, $to];
} elseif ($from) {
    $dateCondition = ' AND finish_date >= ?';
    $dateParams = [$from];
}

$stats = [];

// Average days to finish a book (filtered)
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

// Books per month — calculate based on filtered range
if ($from && $to) {
    $d1 = new DateTime($from);
    $d2 = new DateTime($to);
    $months = max(1, $d1->diff($d2)->m + $d1->diff($d2)->y * 12);
} elseif ($from) {
    $d1 = new DateTime($from);
    $d2 = new DateTime();
    $months = max(1, $d1->diff($d2)->m + $d1->diff($d2)->y * 12);
} else {
    $months = 12; // Default: last 12 months
}

$stmt = $db->prepare("
    SELECT COUNT(*) as count
    FROM bokbad_books
    WHERE user_id = ?
        AND status = 'read'
        AND finish_date IS NOT NULL" . ($dateCondition ?: " AND finish_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)")
);
$stmt->execute(array_merge([$userId], $dateParams));
$row = $stmt->fetch();
$booksInRange = (int)$row['count'];
$stats['booksPerMonth'] = round($booksInRange / $months, 1);

// Estimated pages across all formats (filtered)
$estimatedPages = 0;

// Paper books
$stmt = $db->prepare("
    SELECT COALESCE(SUM(total_pages), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
        AND total_pages IS NOT NULL
        AND (format = 'paper' OR format IS NULL)" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$estimatedPages += (int)$stmt->fetch()['total'];

// E-books
$stmt = $db->prepare("
    SELECT COALESCE(SUM(COALESCE(total_pages, 300)), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
        AND format = 'ebook'" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$estimatedPages += (int)$stmt->fetch()['total'];

// Audiobooks
$stmt = $db->prepare("
    SELECT 
        COALESCE(SUM(CASE 
            WHEN total_pages IS NOT NULL THEN total_pages
            ELSE ROUND(COALESCE(total_duration_min, 0) / 1.5)
        END), 0) as total
    FROM bokbad_books
    WHERE user_id = ? AND status = 'read' AND finish_date IS NOT NULL
        AND format = 'audiobook'" . $dateCondition
);
$stmt->execute(array_merge([$userId], $dateParams));
$estimatedPages += (int)$stmt->fetch()['total'];

$stats['estimatedPages'] = $estimatedPages;

// Reading streak (always current, not filtered)
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

    $streak = 0;
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

    $stats['readingStreak'] = $streak;
} catch (PDOException $e) {
    $stats['readingStreak'] = 0;
}

// Total pages from sessions (filtered year or custom)
$sessionDateCondition = '';
$sessionDateParams = [];
if ($from && $to) {
    $sessionDateCondition = ' AND session_date BETWEEN ? AND ?';
    $sessionDateParams = [$from, $to];
} elseif ($from) {
    $sessionDateCondition = ' AND session_date >= ?';
    $sessionDateParams = [$from];
} else {
    $currentYear = date('Y');
    $sessionDateCondition = ' AND YEAR(session_date) = ?';
    $sessionDateParams = [$currentYear];
}

try {
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(pages_read), 0) as total_pages
        FROM bokbad_reading_sessions
        WHERE user_id = ?" . $sessionDateCondition
    );
    $stmt->execute(array_merge([$userId], $sessionDateParams));
    $row = $stmt->fetch();
    $stats['totalPagesThisYear'] = (int)$row['total_pages'];
} catch (PDOException $e) {
    $stats['totalPagesThisYear'] = 0;
}

sendSuccess(['stats' => $stats]);
