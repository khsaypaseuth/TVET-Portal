# TVED Activity & Task Tracking System — Setup Guide

Admin portal for the Department of Technical and Vocational Education and Training (TVED).

## Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Database `tvet_portal` (create if missing)

## Backend Setup

```bash
cd server
npm install
cp .env.example .env   # edit credentials if needed
npm run migrate
npm run seed
npm run dev
```

API runs on **http://localhost:5001**

### Default Super Admin
- Username / staff code: `admin`
- Password: `admin123`
- Email: `admin@tved.local`

### Environment (`server/.env`)
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tvet_portal
DB_USER=postgres
DB_PASSWORD=your-password
JWT_SECRET=change-me-in-production
JWT_EXPIRE=7d
PORT=5001
NODE_ENV=development
```

## Frontend Setup

```bash
npm install
# optional: echo 'VITE_API_URL=http://localhost:5001/api' > .env
npm run dev
```

Frontend: **http://localhost:5173** — sign in at `/signin`

## API
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)

Accounts are created by Super Admin only (no public registration).
