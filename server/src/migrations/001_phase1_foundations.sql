-- Phase 1 foundations: org, RBAC, expanded users, settings, audit

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name_lo VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  rank_level INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_lo VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  data_scope VARCHAR(50) NOT NULL CHECK (
    data_scope IN ('own', 'direct_reports', 'division', 'assigned_divisions', 'department')
  ),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name_lo VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permission (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS divisions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_lo VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  parent_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  head_user_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expand users table (keep legacy columns for compatibility during transition)
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_code VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name_lo VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_lo VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name_en VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_en VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale_pref VARCHAR(5) DEFAULT 'lo' CHECK (locale_pref IN ('lo', 'en'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff_code ON users(staff_code) WHERE staff_code IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS division_user_oversight (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  UNIQUE (user_id, division_id)
);

ALTER TABLE divisions DROP CONSTRAINT IF EXISTS divisions_head_user_id_fkey;
ALTER TABLE divisions
  ADD CONSTRAINT divisions_head_user_id_fkey
  FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  auditable_type VARCHAR(100) NOT NULL,
  auditable_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_auditable ON audit_logs(auditable_type, auditable_id);
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_users_division ON users(division_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
