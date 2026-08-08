import express from 'express';
import { login, getCurrentUser } from '../controllers/authController.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Login route
router.post('/login', login);

// Get current user (protected route)
router.get('/me', authenticateToken, getCurrentUser);

export default router;

