<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/response.php';

// Start session if not already started
function ensureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        // Persist session cookie for 30 days so mobile homescreen webapp stays logged in
        $lifetime = defined('SESSION_LIFETIME') ? SESSION_LIFETIME : 60 * 60 * 24 * 30;
        ini_set('session.gc_maxlifetime', $lifetime);
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => '/',
            'secure' => true,
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
        'role' => $_SESSION['user_role'] ?? 'user'
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
function loginUser($userId, $username, $role = 'user') {
    ensureSession();
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
    $_SESSION['user_role'] = $role;
    $_SESSION['login_time'] = time();
}

// Logout user
function logoutUser() {
    ensureSession();
    $_SESSION = [];
    session_destroy();
}

// Verify password
function verifyUserPassword($username, $password) {
    $db = Database::getInstance()->getConnection();
    
    $stmt = $db->prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if (!$user) {
        return false;
    }
    
    if (password_verify($password, $user['password_hash'])) {
        return [
            'id' => $user['id'],
            'username' => $user['username'],
            'role' => $user['role'] ?? 'user'
        ];
    }
    
    return false;
}
