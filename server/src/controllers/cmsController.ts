import { Response } from 'express';
import pool from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

function isCmsManager(req: AuthRequest) {
  return req.user?.role === 'super_admin' || req.user?.role === 'admin_staff';
}

export const publicHome = async (_req: AuthRequest, res: Response) => {
  const [banners, news, institutions] = await Promise.all([
    pool.query(`SELECT * FROM banners WHERE is_active = true ORDER BY sort_order LIMIT 5`),
    pool.query(
      `SELECT id, slug, title_lo, title_en, excerpt_lo, excerpt_en, cover_image, published_at
       FROM news WHERE is_published = true ORDER BY published_at DESC NULLS LAST LIMIT 6`
    ),
    pool.query(`SELECT COUNT(*)::int AS count FROM institutions WHERE is_active = true`),
  ]);
  return res.json({
    success: true,
    data: {
      banners: banners.rows,
      latest_news: news.rows,
      stats: { institutions: institutions.rows[0].count },
    },
  });
};

export const publicPage = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT * FROM pages WHERE slug = $1 AND is_published = true`,
    [req.params.slug]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  return res.json({ success: true, data: result.rows[0] });
};

export const publicNewsList = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT n.id, n.slug, n.title_lo, n.title_en, n.excerpt_lo, n.excerpt_en,
            n.cover_image, n.published_at, c.name_lo AS category_lo, c.name_en AS category_en
     FROM news n
     LEFT JOIN news_categories c ON c.id = n.category_id
     WHERE n.is_published = true
     ORDER BY n.published_at DESC NULLS LAST
     LIMIT 50`
  );
  return res.json({ success: true, data: result.rows });
};

export const publicNewsDetail = async (req: AuthRequest, res: Response) => {
  await pool.query(`UPDATE news SET view_count = view_count + 1 WHERE slug = $1`, [
    req.params.slug,
  ]);
  const result = await pool.query(`SELECT * FROM news WHERE slug = $1 AND is_published = true`, [
    req.params.slug,
  ]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  return res.json({ success: true, data: result.rows[0] });
};

export const publicDocuments = async (_req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT id, title_lo, title_en, category, file_size, download_count, published_at
     FROM documents WHERE is_published = true ORDER BY published_at DESC NULLS LAST`
  );
  return res.json({ success: true, data: result.rows });
};

export const publicInstitutions = async (req: AuthRequest, res: Response) => {
  const params: unknown[] = [];
  let where = 'is_active = true';
  if (req.query.province) {
    params.push(req.query.province);
    where += ` AND province = $${params.length}`;
  }
  if (req.query.type) {
    params.push(req.query.type);
    where += ` AND type = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT * FROM institutions WHERE ${where} ORDER BY name_en NULLS LAST, name_lo`,
    params
  );
  return res.json({ success: true, data: result.rows });
};

export const submitContact = async (req: AuthRequest, res: Response) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email, message required' });
  }
  const result = await pool.query(
    `INSERT INTO contact_messages (name, email, phone, subject, message)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
    [name, email, phone || null, subject || null, message]
  );
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const adminListNews = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const result = await pool.query(`SELECT * FROM news ORDER BY created_at DESC`);
  return res.json({ success: true, data: result.rows });
};

export const adminUpsertNews = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const {
    id, slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en,
    cover_image, category_id, is_published, is_featured,
  } = req.body;
  if (!slug || !title_lo) return res.status(400).json({ error: 'slug and title_lo required' });

  if (id) {
    const result = await pool.query(
      `UPDATE news SET slug=$2, title_lo=$3, title_en=$4, excerpt_lo=$5, excerpt_en=$6,
         body_lo=$7, body_en=$8, cover_image=$9, category_id=$10, is_published=$11, is_featured=$12,
         published_at = CASE WHEN $11 AND published_at IS NULL THEN NOW() ELSE published_at END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id=$1 RETURNING *`,
      [id, slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en, cover_image, category_id, !!is_published, !!is_featured]
    );
    return res.json({ success: true, data: result.rows[0] });
  }

  const result = await pool.query(
    `INSERT INTO news (slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en, cover_image, category_id, is_published, is_featured, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $10 THEN NOW() ELSE NULL END)
     RETURNING *`,
    [slug, title_lo, title_en, excerpt_lo, excerpt_en, body_lo, body_en, cover_image, category_id, !!is_published, !!is_featured]
  );
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const adminListPages = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const result = await pool.query(`SELECT * FROM pages ORDER BY slug`);
  return res.json({ success: true, data: result.rows });
};

export const adminUpsertPage = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const { id, slug, title_lo, title_en, body_lo, body_en, is_published } = req.body;
  if (!slug || !title_lo) return res.status(400).json({ error: 'slug and title_lo required' });
  if (id) {
    const result = await pool.query(
      `UPDATE pages SET slug=$2, title_lo=$3, title_en=$4, body_lo=$5, body_en=$6, is_published=$7,
         published_at = CASE WHEN $7 AND published_at IS NULL THEN NOW() ELSE published_at END,
         updated_at = CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
      [id, slug, title_lo, title_en, body_lo, body_en, !!is_published]
    );
    return res.json({ success: true, data: result.rows[0] });
  }
  const result = await pool.query(
    `INSERT INTO pages (slug, title_lo, title_en, body_lo, body_en, is_published, published_at)
     VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $6 THEN NOW() ELSE NULL END) RETURNING *`,
    [slug, title_lo, title_en, body_lo, body_en, !!is_published]
  );
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const adminListInstitutions = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const result = await pool.query(`SELECT * FROM institutions ORDER BY name_en NULLS LAST`);
  return res.json({ success: true, data: result.rows });
};

export const adminUpsertInstitution = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const { id, name_lo, name_en, province, type, address, phone, website, lat, lng, is_active } = req.body;
  if (!name_lo) return res.status(400).json({ error: 'name_lo required' });
  if (id) {
    const result = await pool.query(
      `UPDATE institutions SET name_lo=$2, name_en=$3, province=$4, type=$5, address=$6,
         phone=$7, website=$8, lat=$9, lng=$10, is_active=COALESCE($11,true), updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 RETURNING *`,
      [id, name_lo, name_en, province, type, address, phone, website, lat, lng, is_active]
    );
    return res.json({ success: true, data: result.rows[0] });
  }
  const result = await pool.query(
    `INSERT INTO institutions (name_lo, name_en, province, type, address, phone, website, lat, lng)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name_lo, name_en, province, type, address, phone, website, lat, lng]
  );
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const adminListContacts = async (req: AuthRequest, res: Response) => {
  if (!isCmsManager(req)) return res.status(403).json({ error: 'Forbidden' });
  const result = await pool.query(`SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200`);
  return res.json({ success: true, data: result.rows });
};
