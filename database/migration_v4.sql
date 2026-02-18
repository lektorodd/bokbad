-- Migration v4: Multi-format progress tracking
-- Adds format column, audiobook duration, and e-book percentage tracking

-- Add format column
ALTER TABLE bokbad_books ADD COLUMN format ENUM('paper','ebook','audiobook') NOT NULL DEFAULT 'paper' AFTER is_audiobook;

-- Migrate existing audiobooks
UPDATE bokbad_books SET format = 'audiobook' WHERE is_audiobook = 1;

-- Add audiobook duration fields
ALTER TABLE bokbad_books ADD COLUMN total_duration_min INT COMMENT 'Total audiobook duration in minutes' AFTER current_page;
ALTER TABLE bokbad_books ADD COLUMN current_duration_min INT DEFAULT 0 COMMENT 'Current listening position in minutes' AFTER total_duration_min;

-- Add e-book percentage field (0.00 to 100.00)
ALTER TABLE bokbad_books ADD COLUMN current_percentage DECIMAL(5,2) DEFAULT 0 COMMENT 'Current e-book progress percentage' AFTER current_duration_min;
