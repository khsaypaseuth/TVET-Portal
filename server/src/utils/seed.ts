import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

const seedDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
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
      )
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Hash password for super admin
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Insert or update super admin user
    const result = await pool.query(
      `INSERT INTO users (username, email, password, role, full_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) 
       DO UPDATE SET 
         password = EXCLUDED.password,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         full_name = EXCLUDED.full_name,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        'admin',
        'admin@cms.local',
        hashedPassword,
        'super_admin',
        'Super Administrator',
        true
      ]
    );

    console.log('✅ Database seeded successfully!');
    console.log('📝 Super Admin created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Email: admin@cms.local');
    console.log('   Role: super_admin');

    return result.rows[0];
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;

