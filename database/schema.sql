-- Book Tracking App Database Schema
-- MySQL Database Setup

-- Create database (run this first)
-- CREATE DATABASE bokbad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE bokbad;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Books table
CREATE TABLE IF NOT EXISTS bokbad_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(500) NOT NULL,
    authors JSON COMMENT 'Array of author names',
    cover_image VARCHAR(500) COMMENT 'URL to uploaded image',
    tags JSON COMMENT 'Legacy - migrated to genres/topics',
    genres JSON COMMENT 'Array of genre labels',
    topics JSON COMMENT 'Array of topic labels',
    status ENUM('want-to-read', 'reading', 'read', 'up-next') NOT NULL DEFAULT 'want-to-read',
    thoughts TEXT COMMENT 'Personal notes and key takeaways',
    start_date DATE,
    finish_date DATE,
    isbn VARCHAR(20) COMMENT 'For metadata lookup',
    is_audiobook TINYINT(1) NOT NULL DEFAULT 0,
    format ENUM('paper','ebook','audiobook') NOT NULL DEFAULT 'paper',
    total_pages INT COMMENT 'Total number of pages in book',
    current_page INT DEFAULT 0 COMMENT 'Current reading position',
    total_duration_min INT COMMENT 'Total audiobook duration in minutes',
    current_duration_min INT DEFAULT 0 COMMENT 'Current listening position in minutes',
    current_percentage DECIMAL(5,2) DEFAULT 0 COMMENT 'Current e-book progress percentage',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_status (status),
    INDEX idx_finish_date (finish_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reading sessions table (for future habit tracking feature)
CREATE TABLE IF NOT EXISTS bokbad_reading_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    session_date DATE NOT NULL,
    duration_minutes INT COMMENT 'Reading duration in minutes',
    pages_read INT COMMENT 'Number of pages read',
    notes TEXT COMMENT 'Session notes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES bokbad_books(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, session_date),
    INDEX idx_book_date (book_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test user (username: 'testesen', password: 'password')
-- Password hash generated with: password_hash('password', PASSWORD_DEFAULT)
INSERT INTO users (username, password_hash) VALUES 
('testesen', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON DUPLICATE KEY UPDATE username=username;
