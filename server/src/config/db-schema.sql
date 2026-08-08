-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on username and email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert super admin user (password: admin123 - will be hashed)
-- Default password hash for 'admin123' using bcrypt
-- You can generate a new hash using: bcrypt.hashSync('admin123', 10)
INSERT INTO users (username, email, password, role, full_name, is_active)
VALUES (
  'admin',
  'admin@cms.local',
  '$2a$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZq', -- This will be updated by seed script
  'super_admin',
  'Super Administrator',
  true
)
ON CONFLICT (username) DO NOTHING;

