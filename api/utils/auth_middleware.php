<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/response.php';

function isHttpsRequest() {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    if (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        return strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https';
    }
    return false;
}

// Start session if not already started
function ensureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        // Persist session cookie for 30 days so mobile homescreen webapp stays logged in
        $lifetime = defined('SESSION_LIFETIME') ? SESSION_LIFETIME : 60 * 60 * 24 * 30;
        ini_set('session.gc_maxlifetime', $lifetime);
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => '/',
            'secure' => isHttpsRequest(),
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_start();
    }
}

// Check if user is authenticated
function isAuthenticated() {
    ensureSession();
    return isset($_SESSION['user_id']) && isset($_SESSION['username']);
}

// Get current user ID
function getCurrentUserId() {
    ensureSession();
    return $_SESSION['user_id'] ?? null;
}

// Get current user role
function getCurrentUserRole() {
    ensureSession();
    return $_SESSION['user_role'] ?? 'user';
}

// Check if current user is admin
function isAdmin() {
    return getCurrentUserRole() === 'admin';
}

// Get current user data
function getCurrentUser() {
    ensureSession();
    if (!isAuthenticated()) {
        return null;
    }
    
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'role' => $_SESSION['user_role'] ?? 'user',
        'must_change_password' => $_SESSION['must_change_password'] ?? false
    ];
}

// Require authentication (middleware)
function requireAuth() {
    if (!isAuthenticated()) {
        sendError('Authentication required', 401);
    }
}

// Require admin role (middleware)
function requireAdmin() {
    requireAuth();
    if (!isAdmin()) {
        sendError('Admin access required', 403);
    }
}

// Login user
function loginUser($userId, $username, $role = 'user', $mustChangePw = false) {
    ensureSession();
    // Defend against session fixation by rotating session ID on auth.
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
    $_SESSION['user_role'] = $role;
    $_SESSION['must_change_password'] = (bool)$mustChangePw;
    $_SESSION['login_time'] = time();
}

// Logout user
function logoutUser() {
    ensureSession();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => '/',
            'secure' => isHttpsRequest(),
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    }
    session_destroy();
}

// Verify password
function verifyUserPassword($username, $password) {
    $db = Database::getInstance()->getConnection();
    
    $stmt = $db->prepare("SELECT id, username, password_hash, role, must_change_password FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if (!$user) {
        return false;
    }
    
    if (password_verify($password, $user['password_hash'])) {
        return [
            'id' => $user['id'],
            'username' => $user['username'],
            'role' => $user['role'] ?? 'user',
            'must_change_password' => (bool)$user['must_change_password']
        ];
    }
    
    return false;
}
