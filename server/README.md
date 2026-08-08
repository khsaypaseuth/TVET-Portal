# CMS Backend Server

Backend API server for the CMS application using Express, TypeScript, and PostgreSQL.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the server directory with:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cms_db
   DB_USER=postgres
   DB_PASSWORD=Tv3Vm1eA
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   PORT=5000
   NODE_ENV=development
   ```

3. **Ensure PostgreSQL is running** and the database `cms_db` exists.

4. **Start the server:**
   ```bash
   npm run dev
   ```

   The server will automatically:
   - Create the users table if it doesn't exist
   - Seed a super admin user with:
     - Username: `admin`
     - Password: `admin123`
     - Email: `admin@cms.local`
     - Role: `super_admin`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login user
  - Body: `{ username: string, password: string }`
  - Returns: `{ success: true, data: { user, token } }`

- `GET /api/auth/me` - Get current user (requires authentication)
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ success: true, data: { user } }`

### Health Check

- `GET /api/health` - Server health check

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email
- `password` - Hashed password (bcrypt)
- `role` - User role (default: 'user')
- `full_name` - Full name
- `is_active` - Active status (default: true)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

## Default Super Admin Credentials

- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@cms.local`
- **Role:** `super_admin`

⚠️ **Important:** Change the default password after first login in production!

