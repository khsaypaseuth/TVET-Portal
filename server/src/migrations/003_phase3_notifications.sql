-- Phase 3: notifications

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title_lo VARCHAR(500) NOT NULL,
  title_en VARCHAR(500),
  body_lo TEXT,
  body_en TEXT,
  link_url VARCHAR(500),
  related_type VARCHAR(100),
  related_id INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);
