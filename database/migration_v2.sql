-- Migration v2: Add up-next status, audiobook flag, genres/topics columns
-- Run this on your one.com database

-- 1. Add 'up-next' to the status ENUM
ALTER TABLE bokbad_books 
  MODIFY COLUMN status ENUM('want-to-read', 'reading', 'read', 'up-next') NOT NULL DEFAULT 'want-to-read';

-- 2. Add audiobook flag
ALTER TABLE bokbad_books 
  ADD COLUMN is_audiobook TINYINT(1) NOT NULL DEFAULT 0 AFTER isbn;

-- 3. Add genres and topics JSON columns
ALTER TABLE bokbad_books 
  ADD COLUMN genres JSON COMMENT 'Array of genre labels' AFTER tags;

ALTER TABLE bokbad_books 
  ADD COLUMN topics JSON COMMENT 'Array of topic labels' AFTER genres;

-- 4. Migrate existing tags into topics (preserves all data)
UPDATE bokbad_books 
  SET topics = tags 
  WHERE tags IS NOT NULL AND tags != '[]' AND tags != 'null';

-- 5. Initialize empty arrays where null
UPDATE bokbad_books SET genres = '[]' WHERE genres IS NULL;
UPDATE bokbad_books SET topics = '[]' WHERE topics IS NULL;
