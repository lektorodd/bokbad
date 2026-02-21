<?php
require_once __DIR__ . '/../config/config.php';

class ImageProcessor {
    
    /**
     * Process and save uploaded image
     * @param array $file - $_FILES array element
     * @return array - ['success' => bool, 'url' => string, 'error' => string]
     */
    public static function processUpload($file) {
        // Validate file was uploaded
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return ['success' => false, 'error' => 'No file uploaded'];
        }
        
        // Validate file size
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            $maxMB = MAX_UPLOAD_SIZE / (1024 * 1024);
            return ['success' => false, 'error' => "File too large. Max size: {$maxMB}MB"];
        }
        
        // Validate file type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, ALLOWED_IMAGE_TYPES)) {
            return ['success' => false, 'error' => 'Invalid file type. Only JPEG, PNG, and WebP allowed'];
        }
        
        // Create upload directory if it doesn't exist
        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0755, true);
        }
        
        // Generate unique filename (always .jpg since we save as JPEG)
        $filename = uniqid('cover_', true) . '.jpg';
        $filepath = UPLOAD_DIR . $filename;
        
        // Process and save image
        try {
            $image = self::createImageFromFile($file['tmp_name'], $mimeType);
            if (!$image) {
                return ['success' => false, 'error' => 'Failed to process image'];
            }
            
            // Resize if needed (max 400x600)
            $resized = self::resizeImage($image, 400, 600);
            
            // Save as JPEG for consistency
            imagejpeg($resized, $filepath, 85);
            
            // Clean up
            imagedestroy($image);
            imagedestroy($resized);
            
            // Return URL
            $url = UPLOAD_URL . $filename;
            return ['success' => true, 'url' => $url];
            
        } catch (Exception $e) {
            error_log("Image processing error: " . $e->getMessage());
            return ['success' => false, 'error' => 'Failed to save image'];
        }
    }
    
    /**
     * Create image resource from file
     */
    private static function createImageFromFile($filepath, $mimeType) {
        switch ($mimeType) {
            case 'image/jpeg':
                return imagecreatefromjpeg($filepath);
            case 'image/png':
                return imagecreatefrompng($filepath);
            case 'image/webp':
                return imagecreatefromwebp($filepath);
            default:
                return false;
        }
    }
    
    /**
     * Resize image maintaining aspect ratio
     */
    private static function resizeImage($image, $maxWidth, $maxHeight) {
        $width = imagesx($image);
        $height = imagesy($image);
        
        // Calculate new dimensions
        $ratio = min($maxWidth / $width, $maxHeight / $height);
        
        // Don't upscale
        if ($ratio > 1) {
            $ratio = 1;
        }
        
        $newWidth = (int)($width * $ratio);
        $newHeight = (int)($height * $ratio);
        
        // Create new image
        $resized = imagecreatetruecolor($newWidth, $newHeight);
        
        // Preserve transparency for PNG
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        
        // Resize
        imagecopyresampled(
            $resized, $image,
            0, 0, 0, 0,
            $newWidth, $newHeight,
            $width, $height
        );
        
        return $resized;
    }
    
    /**
     * Get file extension from MIME type
     */
    private static function getExtensionFromMime($mimeType) {
        $map = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp'
        ];
        
        return $map[$mimeType] ?? 'jpg';
    }
    
    /**
     * Delete uploaded image
     */
    public static function deleteImage($url) {
        if (empty($url)) {
            return true;
        }
        
        // Extract filename from URL
        $filename = basename($url);
        $filepath = UPLOAD_DIR . $filename;
        
        if (file_exists($filepath)) {
            return unlink($filepath);
        }
        
        return true;
    }
}
