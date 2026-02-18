-- Migration v5: Reading goals + Series tracking
-- Run this on your database before deploying Phase 7

-- Reading goals table
CREATE TABLE IF NOT EXISTS bokbad_reading_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    year INT NOT NULL,
    target_books INT DEFAULT NULL,
    target_pages INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_year (user_id, year)
);

-- Series tracking table
CREATE TABLE IF NOT EXISTS bokbad_series (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(500) NOT NULL,
    total_books INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- Add series columns to books
ALTER TABLE bokbad_books 
    ADD COLUMN IF NOT EXISTS series_id INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS series_order INT DEFAULT NULL;

-- Add FK for series (wrapped in a procedure for safety)
-- Note: If this fails, the column still exists; just run the FK separately
ALTER TABLE bokbad_books
    ADD FOREIGN KEY (series_id) REFERENCES bokbad_series(id) ON DELETE SET NULL;
