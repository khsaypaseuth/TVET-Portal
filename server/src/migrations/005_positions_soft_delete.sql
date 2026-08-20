-- Soft-deactivate positions (never hard-delete when users may reference them)
ALTER TABLE positions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
