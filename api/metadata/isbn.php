<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/auth_middleware.php';

// Require authentication
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$isbn = $_GET['isbn'] ?? '';

if (empty($isbn)) {
    sendError('ISBN is required', 400);
}

// Clean ISBN (remove hyphens and spaces)
$isbn = preg_replace('/[^0-9X]/i', '', $isbn);

// Try Google Books API first
$metadata = fetchFromGoogleBooks($isbn);

// If not found, try Open Library as fallback
if (!$metadata) {
    $metadata = fetchFromOpenLibrary($isbn);
}

if ($metadata) {
    sendSuccess(['metadata' => $metadata]);
} else {
    sendError('Book not found in any database', 404);
}

// Fetch from Google Books API
function fetchFromGoogleBooks($isbn) {
    $url = GOOGLE_BOOKS_API . "?q=isbn:{$isbn}";
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'user_agent' => 'Bokbad/1.0'
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    
    if (!$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!isset($data['items'][0])) {
        return null;
    }
    
    $book = $data['items'][0]['volumeInfo'];
    
    // Upgrade cover image to higher resolution if available
    $coverImage = $book['imageLinks']['thumbnail'] ?? null;
    if ($coverImage) {
        $coverImage = str_replace('&edge=curl', '', $coverImage);
        $coverImage = str_replace('zoom=1', 'zoom=2', $coverImage);
    }
    
    return [
        'title' => $book['title'] ?? null,
        'authors' => $book['authors'] ?? [],
        'description' => $book['description'] ?? null,
        'categories' => $book['categories'] ?? [],
        'coverImage' => $coverImage,
        'source' => 'Google Books'
    ];
}

// Fetch from Open Library API
function fetchFromOpenLibrary($isbn) {
    $url = "https://openlibrary.org/api/books?bibkeys=ISBN:{$isbn}&format=json&jscmd=data";
    
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'user_agent' => 'Bokbad/1.0'
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    
    if (!$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    $key = "ISBN:{$isbn}";
    
    if (!isset($data[$key])) {
        return null;
    }
    
    $book = $data[$key];
    
    // Extract authors
    $authors = [];
    if (isset($book['authors'])) {
        foreach ($book['authors'] as $author) {
            $authors[] = $author['name'];
        }
    }
    
    // Extract categories/subjects
    $categories = [];
    if (isset($book['subjects'])) {
        foreach (array_slice($book['subjects'], 0, 3) as $subject) {
            $categories[] = $subject['name'];
        }
    }
    
    // Get best cover image
    $coverImage = null;
    if (isset($book['cover']['large'])) {
        $coverImage = $book['cover']['large'];
    } elseif (isset($book['cover']['medium'])) {
        $coverImage = $book['cover']['medium'];
    } elseif (isset($book['cover']['small'])) {
        $coverImage = $book['cover']['small'];
    }
    
    return [
        'title' => $book['title'] ?? null,
        'authors' => $authors,
        'description' => $book['notes'] ?? $book['subtitle'] ?? null,
        'categories' => $categories,
        'coverImage' => $coverImage,
        'source' => 'Open Library'
    ];
}
