<?php
/**
 * Structured file logger with daily rotation.
 *
 * Writes to api/logs/ with one file per day.
 * Log lines are pipe-delimited for easy grepping:
 *   [ISO-8601] [LEVEL] message | {"key":"value"}
 *
 * Usage:
 *   require_once __DIR__ . '/logger.php';
 *   Logger::error('Something failed', ['endpoint' => '/api/books', 'ip' => '1.2.3.4']);
 *   Logger::warn('Login failed', ['username' => 'alice', 'ip' => '10.0.0.1']);
 */

class Logger {
    /** @var string Absolute path to the logs directory */
    private static $logDir = null;

    /**
     * Get (and lazily create) the log directory path.
     */
    private static function getLogDir(): string {
        if (self::$logDir === null) {
            self::$logDir = dirname(__DIR__) . '/logs';
            if (!is_dir(self::$logDir)) {
                mkdir(self::$logDir, 0750, true);
            }
        }
        return self::$logDir;
    }

    /**
     * Log an error-level message.
     *
     * @param string $message Human-readable description
     * @param array  $context Key-value pairs with structured data (never include passwords!)
     */
    public static function error(string $message, array $context = []): void {
        self::write('ERROR', $message, $context);
    }

    /**
     * Log a warning-level message.
     *
     * @param string $message Human-readable description
     * @param array  $context Key-value pairs with structured data
     */
    public static function warn(string $message, array $context = []): void {
        self::write('WARN', $message, $context);
    }

    /**
     * Log an info-level message (disabled by default — enable in config).
     *
     * @param string $message Human-readable description
     * @param array  $context Key-value pairs with structured data
     */
    public static function info(string $message, array $context = []): void {
        // Only log info if explicitly enabled (to avoid noisy logs)
        if (!defined('LOGGER_INFO_ENABLED') || !LOGGER_INFO_ENABLED) {
            return;
        }
        self::write('INFO', $message, $context);
    }

    /**
     * Write a log line to the daily log file.
     *
     * @param string $level  ERROR | WARN | INFO
     * @param string $message
     * @param array  $context
     */
    private static function write(string $level, string $message, array $context): void {
        try {
            $dir = self::getLogDir();
            $date = date('Y-m-d');
            $file = $dir . "/error-{$date}.log";

            $timestamp = date('c'); // ISO-8601
            $contextStr = !empty($context) ? ' | ' . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';

            $line = "[{$timestamp}] [{$level}] {$message}{$contextStr}" . PHP_EOL;

            file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
        } catch (\Throwable $e) {
            // Fallback to PHP's built-in error log if our logger fails.
            // Never throw from the logger — it must not break the app.
            error_log("Logger failed: {$e->getMessage()} (original: [{$level}] {$message})");
        }
    }
}
