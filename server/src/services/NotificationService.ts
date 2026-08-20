import pool from '../config/database.js';

export const NotificationService = {
  async create(params: {
    userId: number;
    type: string;
    title_lo: string;
    title_en?: string;
    body_lo?: string;
    body_en?: string;
    link_url?: string;
    related_type?: string;
    related_id?: number;
  }) {
    const result = await pool.query(
      `INSERT INTO notifications
        (user_id, type, title_lo, title_en, body_lo, body_en, link_url, related_type, related_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        params.userId,
        params.type,
        params.title_lo,
        params.title_en || null,
        params.body_lo || null,
        params.body_en || null,
        params.link_url || null,
        params.related_type || null,
        params.related_id || null,
      ]
    );
    return result.rows[0];
  },

  async listForUser(userId: number, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },

  async unreadCount(userId: number) {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return result.rows[0].count as number;
  },

  async markRead(userId: number, id: number) {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  },

  async markAllRead(userId: number) {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
  },
};
