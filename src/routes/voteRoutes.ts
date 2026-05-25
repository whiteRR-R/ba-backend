//     import { Router } from 'express';
// import { voteController } from '../controllers/voteController';
// import { authMiddleware } from '../middleware/auth';

// const router = Router();

// router.use(authMiddleware);

// router.get('/my-received',                          voteController.getMyReceivedVotes);
// router.post('/',                                    voteController.create);
// router.get('/submission/:submissionId',              voteController.getBySubmission);
// router.get('/challenge/:challengeId/scoreboard',    voteController.getScoreboard);
// router.get('/global',                               voteController.getGlobalRanking);

// export default router;

import { Router } from 'express';
import { voteController } from '../controllers/voteController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/',                                 voteController.create);
router.patch('/:voteId',                         voteController.updateVote);   // ✅
router.delete('/:voteId',                        voteController.deleteVote);   // ✅
router.get('/my-received',                       voteController.getMyReceivedVotes);
router.get('/submission/:submissionId',           voteController.getBySubmission);
router.get('/challenge/:challengeId/scoreboard', voteController.getScoreboard);
router.get('/global',                            voteController.getGlobalRanking);

export default router;