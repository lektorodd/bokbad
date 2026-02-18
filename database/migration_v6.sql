-- Migration v6: Multi-user roles & display names
-- Run this on your database before deploying multi-user support

-- Add role and display_name columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role ENUM('admin','user') NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(200) DEFAULT NULL;

-- Promote the first (oldest) user to admin
UPDATE users SET role = 'admin'
WHERE id = (SELECT min_id FROM (SELECT MIN(id) AS min_id FROM users) AS t);
