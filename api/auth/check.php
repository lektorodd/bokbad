<?php
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

ensureSession();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$user = getCurrentUser();

if ($user) {
    // Update last_login_at at most once per hour
    if (!isset($_SESSION['last_active_written']) || (time() - $_SESSION['last_active_written']) > 3600) {
        $db = Database::getInstance()->getConnection();
        $db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?")->execute([$user['id']]);
        $_SESSION['last_active_written'] = time();
    }

    // Generate CSRF token for this session
    $csrfToken = generateCsrfToken();

    sendSuccess([
        'authenticated' => true,
        'user' => $user,  // includes role from getCurrentUser()
        'csrf_token' => $csrfToken
    ]);
} else {
    sendSuccess([
        'authenticated' => false
    ]);
}
