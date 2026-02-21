<?php
/**
 * Proxy endpoint: download a remote cover image and save it locally.
 * POST { "url": "https://..." }
 * Returns { "success": true, "url": "/uploads/covers/cover_xxx.jpg" }
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/auth_middleware.php';
require_once __DIR__ . '/../utils/response.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = getJsonInput();

if (empty($data['url'])) {
    sendError('URL is required', 400);
}

$remoteUrl = $data['url'];

// Only allow http/https URLs
if (!preg_match('#^https?://#i', $remoteUrl)) {
    sendError('Invalid URL', 400);
}

// Download remote image with timeout and size limit
$context = stream_context_create([
    'http' => [
        'timeout' => 10,
        'max_redirects' => 3,
        'user_agent' => 'Bokbad/1.0',
    ],
    'ssl' => [
        'verify_peer' => true,
    ]
]);

$imageData = @file_get_contents($remoteUrl, false, $context);

if ($imageData === false) {
    sendError('Failed to download image', 400);
}

// Enforce size limit (2MB)
if (strlen($imageData) > MAX_UPLOAD_SIZE) {
    sendError('Remote image too large', 400);
}

// Write to a temp file for processing
$tmpFile = tempnam(sys_get_temp_dir(), 'bokbad_cover_');
file_put_contents($tmpFile, $imageData);

// Validate MIME type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $tmpFile);
finfo_close($finfo);

if (!in_array($mimeType, ALLOWED_IMAGE_TYPES)) {
    unlink($tmpFile);
    sendError('Invalid image type. Only JPEG, PNG, and WebP allowed.', 400);
}

// Create upload directory if needed
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// Process: resize and save as JPEG
try {
    $image = null;
    switch ($mimeType) {
        case 'image/jpeg': $image = imagecreatefromjpeg($tmpFile); break;
        case 'image/png':  $image = imagecreatefrompng($tmpFile);  break;
        case 'image/webp': $image = imagecreatefromwebp($tmpFile); break;
    }

    unlink($tmpFile);

    if (!$image) {
        sendError('Failed to process image', 400);
    }

    // Resize (max 400x600, no upscaling)
    $width = imagesx($image);
    $height = imagesy($image);
    $ratio = min(400 / $width, 600 / $height, 1);
    $newW = (int)($width * $ratio);
    $newH = (int)($height * $ratio);

    $resized = imagecreatetruecolor($newW, $newH);
    imagealphablending($resized, false);
    imagesavealpha($resized, true);
    imagecopyresampled($resized, $image, 0, 0, 0, 0, $newW, $newH, $width, $height);

    $filename = uniqid('cover_', true) . '.jpg';
    $filepath = UPLOAD_DIR . $filename;
    imagejpeg($resized, $filepath, 85);

    imagedestroy($image);
    imagedestroy($resized);

    $url = UPLOAD_URL . $filename;
    sendSuccess(['url' => $url], 201);

} catch (Exception $e) {
    if (file_exists($tmpFile)) unlink($tmpFile);
    error_log('Cover proxy error: ' . $e->getMessage());
    sendError('Failed to process image', 500);
}
