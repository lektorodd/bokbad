<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAdmin();

$db = Database::getInstance()->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // List all users
        $stmt = $db->query("
            SELECT u.id, u.username, u.display_name, u.role, u.created_at,
                   COUNT(b.id) as book_count,
                   SUM(CASE WHEN b.status = 'read' THEN 1 ELSE 0 END) as books_read
            FROM users u
            LEFT JOIN bokbad_books b ON b.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at ASC
        ");
        $users = $stmt->fetchAll();
        sendSuccess(['users' => $users]);
        break;

    case 'POST':
        // Create new user
        $data = getJsonInput();
        validateRequired($data, ['username', 'password']);

        $username = sanitizeString($data['username']);
        $password = $data['password'];
        $displayName = isset($data['display_name']) ? sanitizeString($data['display_name']) : null;
        $role = isset($data['role']) && in_array($data['role'], ['admin', 'user']) ? $data['role'] : 'user';

        if (strlen($password) < 4) {
            sendError('Password must be at least 4 characters', 400);
        }

        // Check if username already exists
        $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            sendError('Username already exists', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $db->prepare("
            INSERT INTO users (username, password_hash, display_name, role)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$username, $passwordHash, $displayName, $role]);

        sendSuccess([
            'user' => [
                'id' => (int)$db->lastInsertId(),
                'username' => $username,
                'display_name' => $displayName,
                'role' => $role
            ]
        ], 201);
        break;

    case 'PUT':
        // Update user
        $data = getJsonInput();
        validateRequired($data, ['id']);

        $userId = (int)$data['id'];

        // Build dynamic update
        $fields = [];
        $params = [];

        if (isset($data['username'])) {
            // Check username uniqueness
            $stmt = $db->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
            $stmt->execute([sanitizeString($data['username']), $userId]);
            if ($stmt->fetch()) {
                sendError('Username already taken', 409);
            }
            $fields[] = 'username = ?';
            $params[] = sanitizeString($data['username']);
        }

        if (isset($data['display_name'])) {
            $fields[] = 'display_name = ?';
            $params[] = sanitizeString($data['display_name']);
        }

        if (isset($data['role']) && in_array($data['role'], ['admin', 'user'])) {
            // Prevent demoting yourself
            $currentUserId = getCurrentUserId();
            if ($userId === $currentUserId && $data['role'] !== 'admin') {
                sendError('Cannot remove your own admin role', 400);
            }
            $fields[] = 'role = ?';
            $params[] = $data['role'];
        }

        if (empty($fields)) {
            sendError('No fields to update', 400);
        }

        $params[] = $userId;
        $stmt = $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);

        sendSuccess(['updated' => true]);
        break;

    case 'PATCH':
        // Reset password (admin action)
        $data = getJsonInput();
        validateRequired($data, ['id', 'new_password']);

        $userId = (int)$data['id'];
        $newPassword = $data['new_password'];

        if (strlen($newPassword) < 4) {
            sendError('Password must be at least 4 characters', 400);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$passwordHash, $userId]);

        sendSuccess(['reset' => true]);
        break;

    case 'DELETE':
        // Delete user
        $userId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$userId) {
            sendError('User ID required', 400);
        }

        // Cannot delete yourself
        if ($userId === getCurrentUserId()) {
            sendError('Cannot delete your own account', 400);
        }

        // Check user exists
        $stmt = $db->prepare("SELECT id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            sendError('User not found', 404);
        }

        // Delete user (CASCADE will remove their books, sessions, etc.)
        $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$userId]);

        sendSuccess(['deleted' => true]);
        break;

    default:
        sendError('Method not allowed', 405);
}
