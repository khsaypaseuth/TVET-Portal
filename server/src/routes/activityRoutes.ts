import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import {
  listActivityTypes,
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  duplicateActivity,
  submitActivity,
  approveActivity,
  rejectActivity,
  bulkApprove,
  approvalsQueue,
  myTeam,
  addComment,
  uploadAttachment,
} from '../controllers/activityController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

const router = Router();
router.use(authenticateToken);

router.get('/types', listActivityTypes);
router.get('/approvals', approvalsQueue);
router.get('/team', myTeam);
router.get('/', listActivities);
router.post('/approvals/bulk', bulkApprove);
router.post('/', createActivity);
router.get('/:id', getActivity);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);
router.post('/:id/duplicate', duplicateActivity);
router.post('/:id/submit', submitActivity);
router.post('/:id/approve', approveActivity);
router.post('/:id/reject', rejectActivity);
router.post('/:id/comments', addComment);
router.post('/:id/attachments', upload.single('file'), uploadAttachment);

export default router;
