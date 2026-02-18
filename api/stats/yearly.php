<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$year = $_GET['year'] ?? date('Y');
$year = (int)$year;

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

// Get books read per month for the year
$stmt = $db->prepare("
    SELECT 
        MONTH(finish_date) as month,
        COUNT(*) as count
    FROM bokbad_books
    WHERE user_id = ?
        AND status = 'read'
        AND YEAR(finish_date) = ?
        AND finish_date IS NOT NULL
    GROUP BY MONTH(finish_date)
    ORDER BY month
");
$stmt->execute([$userId, $year]);
$results = $stmt->fetchAll();

// Initialize all months with 0
$monthlyBreakdown = [];
for ($i = 1; $i <= 12; $i++) {
    $monthlyBreakdown[] = ['month' => $i, 'count' => 0];
}

// Fill in actual counts
foreach ($results as $row) {
    $month = (int)$row['month'];
    $count = (int)$row['count'];
    $monthlyBreakdown[$month - 1]['count'] = $count;
}

// Calculate total for the year
$totalRead = array_sum(array_column($monthlyBreakdown, 'count'));

$response = [
    'year' => $year,
    'totalRead' => $totalRead,
    'monthlyBreakdown' => $monthlyBreakdown
];

// Optional: include previous year for comparison
$compare = $_GET['compare'] ?? null;
if ($compare) {
    $prevYear = $year - 1;
    $stmt = $db->prepare("
        SELECT
            MONTH(finish_date) as month,
            COUNT(*) as count
        FROM bokbad_books
        WHERE user_id = ?
            AND status = 'read'
            AND YEAR(finish_date) = ?
            AND finish_date IS NOT NULL
        GROUP BY MONTH(finish_date)
        ORDER BY month
    ");
    $stmt->execute([$userId, $prevYear]);
    $prevResults = $stmt->fetchAll();

    $prevMonthly = [];
    for ($i = 1; $i <= 12; $i++) {
        $prevMonthly[] = ['month' => $i, 'count' => 0];
    }
    foreach ($prevResults as $row) {
        $month = (int)$row['month'];
        $prevMonthly[$month - 1]['count'] = (int)$row['count'];
    }

    $response['previousYear'] = $prevYear;
    $response['previousMonthlyBreakdown'] = $prevMonthly;
}

sendSuccess($response);
