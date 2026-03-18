<?php
/**
 * Database Migration Runner
 *
 * CLI-only script that applies pending SQL migrations from the database/ directory.
 * Tracks which migrations have been applied via a `bokbad_migrations` table.
 *
 * Usage (SSH into server):
 *   php api/utils/migrate.php           # Apply pending migrations
 *   php api/utils/migrate.php --status  # Show which migrations have been applied
 *
 * Safety:
 *   - CLI-only: exits with error if accessed via web
 *   - Skips already-applied migrations (by filename)
 *   - Prints status for each file
 */

// Block web access
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'CLI only']);
    exit(1);
}

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/logger.php';

$db = Database::getInstance()->getConnection();

// ── Create migrations tracking table if it doesn't exist ──
$db->exec("
    CREATE TABLE IF NOT EXISTS bokbad_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ── Parse arguments ──
$statusOnly = in_array('--status', $argv ?? []);

// ── Get already-applied migrations ──
$applied = [];
$stmt = $db->query("SELECT filename FROM bokbad_migrations ORDER BY applied_at");
while ($row = $stmt->fetch()) {
    $applied[] = $row['filename'];
}

// ── Discover migration files ──
$migrationsDir = dirname(__DIR__, 2) . '/database';
$files = glob($migrationsDir . '/migration_*.sql');
sort($files); // Alphabetical = chronological (migration_v2, migration_v3, ...)

if (empty($files)) {
    echo "No migration files found in {$migrationsDir}\n";
    exit(0);
}

// ── Status mode ──
if ($statusOnly) {
    echo "\nMigration Status:\n";
    echo str_repeat('─', 60) . "\n";
    foreach ($files as $file) {
        $basename = basename($file);
        $status = in_array($basename, $applied) ? '✅ Applied' : '⬜ Pending';
        echo "  {$status}  {$basename}\n";
    }
    echo str_repeat('─', 60) . "\n";
    echo "  " . count($applied) . " applied, " . (count($files) - count($applied)) . " pending\n\n";
    exit(0);
}

// ── Apply pending migrations ──
$pendingCount = 0;
$errorCount = 0;

echo "\nRunning migrations...\n";
echo str_repeat('─', 60) . "\n";

foreach ($files as $file) {
    $basename = basename($file);

    if (in_array($basename, $applied)) {
        echo "  ⏭  {$basename} (already applied)\n";
        continue;
    }

    $sql = file_get_contents($file);
    if ($sql === false) {
        echo "  ❌ {$basename} (could not read file)\n";
        Logger::error('Migration file unreadable', ['file' => $basename]);
        $errorCount++;
        continue;
    }

    try {
        $db->exec($sql);
        // Record as applied
        $db->prepare("INSERT INTO bokbad_migrations (filename) VALUES (?)")
           ->execute([$basename]);
        echo "  ✅ {$basename} (applied)\n";
        Logger::info('Migration applied', ['file' => $basename]);
        $pendingCount++;
    } catch (\PDOException $e) {
        echo "  ❌ {$basename}: {$e->getMessage()}\n";
        Logger::error('Migration failed', [
            'file' => $basename,
            'error' => $e->getMessage(),
        ]);
        $errorCount++;
        // Continue with other migrations instead of stopping
    }
}

echo str_repeat('─', 60) . "\n";
echo "  {$pendingCount} applied, {$errorCount} errors\n\n";

exit($errorCount > 0 ? 1 : 0);
