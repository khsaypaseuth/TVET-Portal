-- Phase 5: public CMS tables

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(200) UNIQUE NOT NULL,
  title_lo VARCHAR(500) NOT NULL,
  title_en VARCHAR(500),
  body_lo TEXT,
  body_en TEXT,
  template VARCHAR(50) DEFAULT 'default',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(200) UNIQUE NOT NULL,
  name_lo VARCHAR(255) NOT NULL,
  name_en VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(200) UNIQUE NOT NULL,
  title_lo VARCHAR(500) NOT NULL,
  title_en VARCHAR(500),
  excerpt_lo TEXT,
  excerpt_en TEXT,
  body_lo TEXT,
  body_en TEXT,
  cover_image VARCHAR(1000),
  category_id INTEGER REFERENCES news_categories(id) ON DELETE SET NULL,
  published_at TIMESTAMP,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title_lo VARCHAR(500) NOT NULL,
  title_en VARCHAR(500),
  file_path VARCHAR(1000) NOT NULL,
  category VARCHAR(100),
  file_size INTEGER,
  download_count INTEGER DEFAULT 0,
  published_at TIMESTAMP,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  image_path VARCHAR(1000) NOT NULL,
  title_lo VARCHAR(500),
  title_en VARCHAR(500),
  link_url VARCHAR(1000),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_events (
  id SERIAL PRIMARY KEY,
  title_lo VARCHAR(500) NOT NULL,
  title_en VARCHAR(500),
  description_lo TEXT,
  description_en TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  location_lo VARCHAR(500),
  location_en VARCHAR(500),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(500),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  name_lo VARCHAR(500) NOT NULL,
  name_en VARCHAR(500),
  province VARCHAR(100),
  type VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  website VARCHAR(500),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_institutions_province ON institutions(province);
