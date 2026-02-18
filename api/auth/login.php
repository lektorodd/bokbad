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

$username = sanitizeString($data['username']);
$password = $data['password'];

// Verify credentials
$user = verifyUserPassword($username, $password);

if (!$user) {
    sendError('Invalid username or password', 401);
}

// Handle remember_me: adjust session cookie lifetime
$rememberMe = isset($data['remember_me']) ? (bool)$data['remember_me'] : true;
if (!$rememberMe) {
    // Short session: expires when browser closes (lifetime = 0)
    session_destroy();
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    ini_set('session.gc_maxlifetime', 60 * 60 * 2); // 2 hours
    session_start();
}

// Login user
loginUser($user['id'], $user['username'], $user['role'] ?? 'user');

// Return success
sendSuccess([
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'] ?? 'user'
    ]
]);
