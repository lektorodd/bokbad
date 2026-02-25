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

function isPublicIpAddress($ip) {
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
}

function isAllowedRemoteHost($host) {
    if (!$host) {
        return false;
    }

    // Direct IP host
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return isPublicIpAddress($host);
    }

    // Resolve hostname and reject hosts that map to private/reserved ranges.
    $ips = @gethostbynamel($host);
    if (!$ips || !is_array($ips)) {
        return false;
    }

    foreach ($ips as $ip) {
        if (!isPublicIpAddress($ip)) {
            return false;
        }
    }

    return true;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = getJsonInput();

if (empty($data['url'])) {
    sendError('URL is required', 400);
}

$remoteUrl = $data['url'];

// Validate URL and block local/private targets (SSRF hardening).
$parts = parse_url($remoteUrl);
if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
    sendError('Invalid URL', 400);
}

$scheme = strtolower($parts['scheme']);
if (!in_array($scheme, ['http', 'https'], true)) {
    sendError('Invalid URL', 400);
}

if (!isAllowedRemoteHost($parts['host'])) {
    sendError('Invalid URL', 400);
}

// Download remote image with timeout and hard byte limit.
$context = stream_context_create([
    'http' => [
        'timeout' => 10,
        'max_redirects' => 0,
        'follow_location' => 0,
        'ignore_errors' => true,
        'user_agent' => 'Bokbad/1.0',
    ],
    'ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'allow_self_signed' => false
    ]
]);

$stream = @fopen($remoteUrl, 'rb', false, $context);
if ($stream === false) {
    sendError('Failed to download image', 400);
}

$statusLine = $http_response_header[0] ?? '';
if (!preg_match('/^HTTP\/\S+\s+2\d\d\b/', $statusLine)) {
    fclose($stream);
    sendError('Failed to download image', 400);
}

$tmpFile = tempnam(sys_get_temp_dir(), 'bokbad_cover_');
if ($tmpFile === false) {
    fclose($stream);
    sendError('Failed to process image', 500);
}
$tmpHandle = fopen($tmpFile, 'wb');
if ($tmpHandle === false) {
    fclose($stream);
    unlink($tmpFile);
    sendError('Failed to process image', 500);
}

$bytes = 0;
while (!feof($stream)) {
    $chunk = fread($stream, 8192);
    if ($chunk === false) {
        fclose($stream);
        fclose($tmpHandle);
        unlink($tmpFile);
        sendError('Failed to download image', 400);
    }

    $bytes += strlen($chunk);
    if ($bytes > MAX_UPLOAD_SIZE) {
        fclose($stream);
        fclose($tmpHandle);
        unlink($tmpFile);
        sendError('Remote image too large', 400);
    }

    if (fwrite($tmpHandle, $chunk) === false) {
        fclose($stream);
        fclose($tmpHandle);
        unlink($tmpFile);
        sendError('Failed to process image', 500);
    }
}

fclose($stream);
fclose($tmpHandle);

if ($bytes === 0) {
    unlink($tmpFile);
    sendError('Failed to download image', 400);
}

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
