-- Migration v3: Add reading progress fields + reading sessions enhancements
-- Run this on your one.com database

-- 1. Add total_pages and current_page to books table
ALTER TABLE bokbad_books
  ADD COLUMN total_pages INT COMMENT 'Total number of pages in book' AFTER is_audiobook;

ALTER TABLE bokbad_books
  ADD COLUMN current_page INT DEFAULT 0 COMMENT 'Current reading position' AFTER total_pages;

-- 2. Add duration_minutes to reading_sessions if missing (already in schema but ensure)
-- The column already exists in schema.sql, no action needed.

-- 3. Initialize current_page where null
UPDATE bokbad_books SET current_page = 0 WHERE current_page IS NULL;
