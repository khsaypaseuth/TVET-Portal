import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { NotificationService } from '../services/NotificationService.js';

export const listNotifications = async (req: AuthRequest, res: Response) => {
  const data = await NotificationService.listForUser(req.user!.id);
  const unread = await NotificationService.unreadCount(req.user!.id);
  return res.json({ success: true, data, unread });
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  await NotificationService.markRead(req.user!.id, Number(req.params.id));
  return res.json({ success: true });
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  await NotificationService.markAllRead(req.user!.id);
  return res.json({ success: true });
};
