# CMS Login System Setup Guide

## Backend Setup

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies (if not already done):**
   ```bash
   npm install
   ```

3. **Create `.env` file** in the `server` directory:
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

4. **Ensure PostgreSQL is running** and database `cms_db` exists:
   ```bash
   # Connect to PostgreSQL and create database if needed
   psql -U postgres
   CREATE DATABASE cms_db;
   \q
   ```

5. **Start the backend server:**
   ```bash
   npm run dev
   ```

   The server will:
   - Automatically create the `users` table
   - Seed a super admin user with credentials:
     - **Username:** `admin`
     - **Password:** `admin123`
     - **Email:** `admin@cms.local`
     - **Role:** `super_admin`

   Server will run on `http://localhost:5000`

## Frontend Setup

1. **Ensure frontend dependencies are installed:**
   ```bash
   npm install
   ```

2. **Create `.env` file** in the root directory (optional, defaults to localhost:5000):
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

   Frontend will run on `http://localhost:5173`

## Testing the Login

1. Open `http://localhost:5173/signin`
2. Use the super admin credentials:
   - **Username:** `admin` (or email: `admin@cms.local`)
   - **Password:** `admin123`
3. Click "Sign In"
4. You should be redirected to the dashboard

## API Endpoints

- `POST /api/auth/login` - Login endpoint
- `GET /api/auth/me` - Get current user (requires authentication)
- `GET /api/health` - Health check

## Project Structure

```
CMS/
├── server/                 # Backend server
│   ├── src/
│   │   ├── config/        # Database configuration
│   │   ├── controllers/   # Route controllers
│   │   ├── middleware/    # Auth middleware
│   │   ├── models/        # Database models
│   │   ├── routes/        # API routes
│   │   └── utils/         # Utilities (seed script)
│   └── package.json
├── src/                    # Frontend React app
│   ├── components/
│   │   └── auth/          # Auth components
│   ├── context/           # React contexts (Auth, Theme)
│   ├── services/          # API service
│   └── ...
└── package.json
```

## Troubleshooting

- **Database connection error:** Ensure PostgreSQL is running and credentials are correct
- **Port already in use:** Change PORT in server/.env
- **CORS errors:** Backend CORS is configured to allow all origins in development
- **Token expired:** Default JWT expiry is 7 days, can be changed in .env

