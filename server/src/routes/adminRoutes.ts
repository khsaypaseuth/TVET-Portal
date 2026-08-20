import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  listDivisions,
  createDivision,
  updateDivision,
  deactivateDivision,
  listPositions,
  createPosition,
  updatePosition,
  deactivatePosition,
  listRoles,
  setOversight,
  listAuditLogs,
} from '../controllers/adminController.js';

const router = Router();
router.use(authenticateToken);

router.get('/users', listUsers);
router.post('/users', requireRole('super_admin'), createUser);
router.put('/users/:id', requireRole('super_admin'), updateUser);
router.delete('/users/:id', requireRole('super_admin'), deactivateUser);
router.put('/users/:id/oversight', requireRole('super_admin'), setOversight);

router.get('/divisions', listDivisions);
router.post('/divisions', requireRole('super_admin'), createDivision);
router.put('/divisions/:id', requireRole('super_admin'), updateDivision);
router.delete('/divisions/:id', requireRole('super_admin'), deactivateDivision);

router.get('/positions', listPositions);
router.post('/positions', requireRole('super_admin'), createPosition);
router.put('/positions/:id', requireRole('super_admin'), updatePosition);
router.delete('/positions/:id', requireRole('super_admin'), deactivatePosition);

router.get('/roles', listRoles);
router.get('/audit-logs', listAuditLogs);

export default router;
