import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getDashboard,
  runReport,
  exportExcel,
  exportPdf,
} from '../controllers/reportController.js';

const router = Router();
router.use(authenticateToken);

router.get('/dashboard', getDashboard);
router.get('/:type/excel', exportExcel);
router.get('/:type/pdf', exportPdf);
router.get('/:type', runReport);

export default router;
