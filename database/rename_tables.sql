-- Rename tables to match new code structure
RENAME TABLE books TO bokbad_books;

-- Check if reading_sessions exists before renaming (it might not if you haven't used it)
-- If this gives an error, you can ignore it or just run the first line
RENAME TABLE reading_sessions TO bokbad_reading_sessions;
