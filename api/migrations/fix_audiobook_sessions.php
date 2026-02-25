<?php
/**
 * One-time migration: Fix audiobook session duration_minutes
 * 
 * Old sessions stored the absolute audiobook position (e.g., 130 min)
 * instead of the session delta (e.g., 15 min listened).
 * This script recalculates each session's duration_minutes as the
 * delta from the previous session for the same audiobook.
 *
 * Run once: php api/migrations/fix_audiobook_sessions.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Forbidden\n";
    exit(1);
}

require_once __DIR__ . '/../config/database.php';

header('Content-Type: text/plain');

$db = Database::getInstance()->getConnection();

echo "=== Fix Audiobook Session Durations ===\n\n";

try {
    // Get all audiobook book IDs
    $stmt = $db->query("
        SELECT DISTINCT b.id, b.name 
        FROM bokbad_books b 
        WHERE b.format = 'audiobook'
        ORDER BY b.id
    ");
    $audiobooks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($audiobooks) . " audiobook(s)\n\n";

    $totalFixed = 0;

    foreach ($audiobooks as $book) {
        // Get all sessions for this audiobook, ordered by date
        $stmt = $db->prepare("
            SELECT id, session_date, duration_minutes 
            FROM bokbad_reading_sessions 
            WHERE book_id = ? AND duration_minutes IS NOT NULL
            ORDER BY session_date ASC, id ASC
        ");
        $stmt->execute([$book['id']]);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($sessions) === 0) continue;

        $sessionCount = count($sessions);
        echo "Book: {$book['name']} (ID: {$book['id']}) — {$sessionCount} session(s)\n";

        $previousPosition = 0;
        $updateStmt = $db->prepare("UPDATE bokbad_reading_sessions SET duration_minutes = ? WHERE id = ?");

        foreach ($sessions as $session) {
            $absolutePosition = (int)$session['duration_minutes'];
            
            // Calculate delta from previous position
            $delta = $absolutePosition - $previousPosition;
            if ($delta < 0) $delta = 0; // Safety: shouldn't happen but just in case
            
            if ($delta !== $absolutePosition) {
                $updateStmt->execute([$delta, $session['id']]);
                echo "  Session {$session['id']} ({$session['session_date']}): {$absolutePosition}min → {$delta}min delta\n";
                $totalFixed++;
            } else {
                echo "  Session {$session['id']} ({$session['session_date']}): {$absolutePosition}min (already correct or first session)\n";
            }

            $previousPosition = $absolutePosition;
        }
        echo "\n";
    }

    echo "✅ Done! Fixed {$totalFixed} session(s).\n";

} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
