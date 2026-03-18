<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

ensureSession();

// Handle login request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = getJsonInput();
validateRequired($data, ['username', 'password']);

$username = sanitizeInput($data['username']);
$password = $data['password'];

// --- Brute-force protection ---
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$maxAttempts = 5;
$lockoutMinutes = 15;

$db = Database::getInstance()->getConnection();

// Clean up old attempts (> lockout window)
$db->prepare("DELETE FROM login_attempts WHERE attempt_time < DATE_SUB(NOW(), INTERVAL ? MINUTE)")
   ->execute([$lockoutMinutes]);

// Count recent failed attempts for this IP+username
$stmt = $db->prepare(
    "SELECT COUNT(*) as cnt FROM login_attempts 
     WHERE ip_address = ? AND username = ? 
     AND attempt_time > DATE_SUB(NOW(), INTERVAL ? MINUTE)"
);
$stmt->execute([$ip, $username, $lockoutMinutes]);
$attempts = (int) $stmt->fetch()['cnt'];

if ($attempts >= $maxAttempts) {
    sendError('Too many login attempts. Please try again in ' . $lockoutMinutes . ' minutes.', 429);
}

// Verify credentials
$user = verifyUserPassword($username, $password);

if (!$user) {
    // Record failed attempt
    $db->prepare("INSERT INTO login_attempts (ip_address, username) VALUES (?, ?)")
       ->execute([$ip, $username]);
    
    $remaining = $maxAttempts - $attempts - 1;

    // Log failed login via structured logger
    require_once __DIR__ . '/../utils/logger.php';
    Logger::warn('Login failed', [
        'username' => $username,
        'ip' => $ip,
        'remainingAttempts' => $remaining,
    ]);

    $msg = 'Invalid username or password';
    if ($remaining <= 2 && $remaining > 0) {
        $msg .= ' (' . $remaining . ' attempts remaining)';
    }
    sendError($msg, 401);
}

// Success — clear failed attempts for this IP+username
$db->prepare("DELETE FROM login_attempts WHERE ip_address = ? AND username = ?")
   ->execute([$ip, $username]);

// Handle remember_me: adjust session cookie lifetime
$rememberMe = isset($data['remember_me']) ? (bool)$data['remember_me'] : true;
if (!$rememberMe) {
    // Short session: expires when browser closes (lifetime = 0)
    session_destroy();
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => isHttpsRequest(),
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    ini_set('session.gc_maxlifetime', 60 * 60 * 2); // 2 hours
    session_start();
}

// Login user
loginUser($user['id'], $user['username'], $user['role'] ?? 'user', $user['must_change_password'] ?? false);

// Track last login
$db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?")->execute([$user['id']]);

// Return success with CSRF token (session_regenerate_id in loginUser destroys the old one)
sendSuccess([
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'] ?? 'user',
        'must_change_password' => (bool)($user['must_change_password'] ?? false)
    ],
    'csrf_token' => generateCsrfToken()
]);
