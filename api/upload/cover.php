<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/image_processor.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Check if file was uploaded
if (!isset($_FILES['image'])) {
    sendError('No image file provided');
}

// Process upload
$result = ImageProcessor::processUpload($_FILES['image']);

if ($result['success']) {
    sendSuccess(['url' => $result['url']], 201);
} else {
    sendError($result['error'], 400);
}
