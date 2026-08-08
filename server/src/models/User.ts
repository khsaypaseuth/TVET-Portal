import pool from '../config/database.js';

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

export const UserModel = {
  // Find user by username
  findByUsername: async (username: string): Promise<User | null> => {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );
    return result.rows[0] || null;
  },

  // Find user by email
  findByEmail: async (email: string): Promise<User | null> => {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    return result.rows[0] || null;
  },

  // Find user by ID
  findById: async (id: number): Promise<UserWithoutPassword | null> => {
    const result = await pool.query(
      'SELECT id, username, email, role, full_name, is_active, created_at, updated_at FROM users WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  },

  // Create new user
  create: async (userData: {
    username: string;
    email: string;
    password: string;
    role?: string;
    full_name?: string;
  }): Promise<UserWithoutPassword> => {
    const result = await pool.query(
      `INSERT INTO users (username, email, password, role, full_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, full_name, is_active, created_at, updated_at`,
      [
        userData.username,
        userData.email,
        userData.password,
        userData.role || 'user',
        userData.full_name || null,
      ]
    );
    return result.rows[0];
  },
};

