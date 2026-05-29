import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['admin', 'moderator']));

router.get('/challenges/search', adminController.searchChallenges);
router.get('/challenges/:id', adminController.getChallengeDetail);
router.patch('/challenges/:id/complete', adminController.completeChallenge);
router.delete('/challenges/:id/kick/:userId', adminController.kickParticipant);
router.post('/challenges/:id/resolve-dispute', adminController.resolveDispute);
router.delete('/challenges/:id', adminController.deleteChallenge);

export default router;
