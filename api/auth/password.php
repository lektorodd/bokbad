<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = getJsonInput();
validateRequired($data, ['current_password', 'new_password']);

$currentPassword = $data['current_password'];
$newPassword = $data['new_password'];

if (strlen($newPassword) < 4) {
    sendError('New password must be at least 4 characters', 400);
}

$db = Database::getInstance()->getConnection();
$userId = getCurrentUserId();

// Verify current password
$stmt = $db->prepare("SELECT password_hash FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
    sendError('Current password is incorrect', 401);
}

// Update password and clear must_change_password flag
$newHash = password_hash($newPassword, PASSWORD_DEFAULT);
$stmt = $db->prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?");
$stmt->execute([$newHash, $userId]);

// Clear session flag
$_SESSION['must_change_password'] = false;

sendSuccess(['changed' => true]);
