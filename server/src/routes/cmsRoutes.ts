import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  publicHome,
  publicPage,
  publicNewsList,
  publicNewsDetail,
  publicDocuments,
  publicInstitutions,
  submitContact,
  adminListNews,
  adminUpsertNews,
  adminListPages,
  adminUpsertPage,
  adminListInstitutions,
  adminUpsertInstitution,
  adminListContacts,
} from '../controllers/cmsController.js';

const publicRouter = Router();
publicRouter.get('/home', publicHome);
publicRouter.get('/pages/:slug', publicPage);
publicRouter.get('/news', publicNewsList);
publicRouter.get('/news/:slug', publicNewsDetail);
publicRouter.get('/documents', publicDocuments);
publicRouter.get('/institutions', publicInstitutions);
publicRouter.post('/contact', submitContact);

const adminRouter = Router();
adminRouter.use(authenticateToken);
adminRouter.get('/news', adminListNews);
adminRouter.post('/news', adminUpsertNews);
adminRouter.get('/pages', adminListPages);
adminRouter.post('/pages', adminUpsertPage);
adminRouter.get('/institutions', adminListInstitutions);
adminRouter.post('/institutions', adminUpsertInstitution);
adminRouter.get('/contacts', adminListContacts);

export { publicRouter, adminRouter };
