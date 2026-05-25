import { Router } from 'express';
import { familyController } from '../controllers/familyController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/members',                      familyController.getMembers);
router.post('/members',                     familyController.addMember);
router.put('/members/:memberId',            familyController.updateMember);
router.delete('/members/:memberId',         familyController.deleteMember);
router.get('/all-members', familyController.getAllFamilyMembers);

router.get('/events',                       familyController.getEvents);
router.post('/events',                      familyController.addEvent);
router.delete('/events/:eventId',           familyController.deleteEvent);

// ✅ Поиск пользователей и приглашения
router.get('/search-users',                 familyController.searchUsers);
router.post('/invite',                      familyController.sendInvite);
router.get('/invites',                      familyController.getMyInvites);
router.patch('/invites/:inviteId',          familyController.respondInvite);

export default router;