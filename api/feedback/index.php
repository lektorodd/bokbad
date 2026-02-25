<?php
// Feedback API — submit feedback from Bokbad
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = getJsonInput();
validateRequired($data, ['message']);

$message = trim($data['message']);
if (strlen($message) < 3) {
    sendError('Message must be at least 3 characters', 400);
}
if (strlen($message) > 2000) {
    sendError('Message must be at most 2000 characters', 400);
}

$userId = getCurrentUserId();
$user = getCurrentUser();
$username = $user['username'];

$db = Database::getInstance()->getConnection();
$stmt = $db->prepare("
    INSERT INTO platform_feedback (user_id, username, app_id, message)
    VALUES (?, ?, 'bokbad', ?)
");
$stmt->execute([$userId, $username, $message]);

sendSuccess(['submitted' => true]);
