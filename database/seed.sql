-- ⚠️  DEVELOPMENT ONLY — Do NOT run in production!
-- This file creates a test user for local development.
-- Username: testesen  |  Password: password

INSERT INTO users (username, password_hash, role) VALUES 
('testesen', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON DUPLICATE KEY UPDATE username=username;
