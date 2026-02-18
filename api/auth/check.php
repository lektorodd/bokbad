<?php
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

ensureSession();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$user = getCurrentUser();

if ($user) {
    sendSuccess([
        'authenticated' => true,
        'user' => $user  // includes role from getCurrentUser()
    ]);
} else {
    sendSuccess([
        'authenticated' => false
    ]);
}
