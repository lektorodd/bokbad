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

// Check local database first — reuse cover from any user's book with same ISBN
$db = Database::getInstance()->getConnection();
$stmt = $db->prepare("
    SELECT name, authors, cover_image, total_pages
    FROM bokbad_books
    WHERE isbn = ? AND cover_image IS NOT NULL AND cover_image != ''
    LIMIT 1
");
$stmt->execute([$isbn]);
$localBook = $stmt->fetch();

if ($localBook) {
    // Verify cover file actually exists on disk before returning it
    $coverImage = $localBook['cover_image'];
    if ($coverImage && strpos($coverImage, '/uploads/') === 0) {
        $coverPath = __DIR__ . '/../../' . ltrim($coverImage, '/');
        if (!file_exists($coverPath)) {
            $coverImage = null; // File missing — will re-fetch from external API below
        }
    }

    if ($coverImage) {
        sendSuccess(['metadata' => [
            'title'      => $localBook['name'],
            'authors'    => json_decode($localBook['authors'], true) ?: [],
            'coverImage' => $coverImage,
            'pageCount'  => $localBook['total_pages'] ? (int)$localBook['total_pages'] : null,
            'source'     => 'Local Library',
        ]]);
    }
    // If cover is missing, fall through to external APIs to get a fresh one
}

// Try Google Books API first
$metadata = fetchFromGoogleBooks($isbn);

// If not found, try Open Library as fallback
if (!$metadata) {
    $metadata = fetchFromOpenLibrary($isbn);
}

// If still not found, try Norwegian National Library
if (!$metadata) {
    $metadata = fetchFromNationalLibraryNorway($isbn);
}

// If we have metadata but no cover, try Open Library Covers as a last resort
if ($metadata && empty($metadata['coverImage'])) {
    $metadata['coverImage'] = fetchCoverFromOpenLibraryCovers($isbn);
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

// Fetch from Norwegian National Library (nb.no)
function fetchFromNationalLibraryNorway($isbn) {
    $url = "https://api.nb.no/catalog/v1/items?q=isbn:{$isbn}&digitalAccessibleOnly=false";

    $context = stream_context_create([
        'http' => [
            'timeout'    => 5,
            'user_agent' => 'Bokbad/1.0'
        ]
    ]);

    $response = @file_get_contents($url, false, $context);
    if (!$response) return null;

    $data = json_decode($response, true);
    $items = $data['_embedded']['items'] ?? [];
    if (empty($items)) return null;

    $item = $items[0];
    $meta = $item['metadata'] ?? [];

    // Title
    $title = $meta['titleInfos'][0]['title'] ?? null;

    // Authors
    $authors = [];
    foreach ($meta['creators'] ?? [] as $creator) {
        if (!empty($creator['name'])) {
            $authors[] = $creator['name'];
        }
    }

    // Page count
    $pageCount = isset($meta['pageCount']) ? (int)$meta['pageCount'] : null;

    // Cover image via IIIF manifest
    $coverImage = null;
    $iiifUrl = $item['_links']['iiifManifest']['href'] ?? null;
    if ($iiifUrl) {
        $iiifContext = stream_context_create([
            'http' => ['timeout' => 3, 'user_agent' => 'Bokbad/1.0']
        ]);
        $iiifResponse = @file_get_contents($iiifUrl, false, $iiifContext);
        if ($iiifResponse) {
            $manifest = json_decode($iiifResponse, true);
            $coverImage = $manifest['sequences'][0]['canvases'][0]['images'][0]['resource']['@id'] ?? null;
        }
    }

    if (!$title && empty($authors)) return null;

    return [
        'title'       => $title,
        'authors'     => $authors,
        'description' => null,
        'categories'  => [],
        'coverImage'  => $coverImage,
        'pageCount'   => $pageCount,
        'source'      => 'Nasjonalbiblioteket',
    ];
}

// Fetch cover image only from Open Library Covers API (last resort)
function fetchCoverFromOpenLibraryCovers($isbn) {
    $url = "https://covers.openlibrary.org/b/isbn/{$isbn}-L.jpg?default=false";

    $context = stream_context_create([
        'http' => [
            'timeout'    => 3,
            'method'     => 'HEAD',
            'user_agent' => 'Bokbad/1.0'
        ]
    ]);

    $headers = @get_headers($url, 0, $context);
    if (!$headers) return null;

    // get_headers returns the status line as the first element
    $status = $headers[0] ?? '';
    if (strpos($status, '200') !== false) {
        // Strip the ?default=false so the URL is clean for the frontend
        return "https://covers.openlibrary.org/b/isbn/{$isbn}-L.jpg";
    }

    return null;
}
