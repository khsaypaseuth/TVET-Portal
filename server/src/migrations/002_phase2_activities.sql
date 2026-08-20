-- Phase 2: activities domain

CREATE TABLE IF NOT EXISTS activity_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_lo VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  colour VARCHAR(20) DEFAULT '#3B82F6',
  icon VARCHAR(50),
  requires_location BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  activity_type_id INTEGER NOT NULL REFERENCES activity_types(id),
  title_lo VARCHAR(500) NOT NULL,
  title_en VARCHAR(500),
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  duration_minutes INTEGER DEFAULT 0,
  location VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled')
  ),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  parent_activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  CONSTRAINT activities_date_order CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS activity_participants (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  external_name VARCHAR(255),
  role_in_activity VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  file_path VARCHAR(1000) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_comments (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities(user_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_division_start ON activities(division_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type_id) WHERE deleted_at IS NULL;
