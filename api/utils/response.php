<?php
// JSON response helper functions
require_once __DIR__ . '/logger.php';

function sendResponse($success, $data = null, $httpCode = 200) {
    http_response_code($httpCode);
    $response = ['success' => $success];
    
    if ($data !== null) {
        $response = array_merge($response, $data);
    }
    
    // Auto-log server errors
    if ($httpCode >= 500) {
        Logger::error($data['error'] ?? 'Server error', [
            'httpCode' => $httpCode,
            'endpoint' => $_SERVER['REQUEST_URI'] ?? 'unknown',
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ]);
    }
    
    echo json_encode($response);
    exit();
}

function sendError($message, $httpCode = 400) {
    sendResponse(false, ['error' => $message], $httpCode);
}

function sendSuccess($data = [], $httpCode = 200) {
    sendResponse(true, $data, $httpCode);
}

function getJsonInput() {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendError('Invalid JSON input', 400);
    }
    
    return $data ?? [];
}

function validateRequired($data, $fields) {
    $missing = [];
    
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
        }
    }
    
    if (!empty($missing)) {
        sendError('Missing required fields: ' . implode(', ', $missing), 400);
    }
}

function sanitizeInput($str) {
    return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
}

/** @deprecated Use sanitizeInput() instead */
function sanitizeString($str) {
    return sanitizeInput($str);
}
