import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import { Vote, Submission, Participant, Task, User } from '../models';
import { notificationHelper } from '../services/notificationHelper';

export const voteController = {

  // POST /api/votes
  create: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { submissionId, score, isAnonymous, comment } = req.body; // ✅ добавили comment
      const voterId = req.user!.id;

      if (!score || score < 1 || score > 5) {
        res.status(400).json({ message: 'Оценка должна быть от 1 до 5' });
        return;
      }

      const submission = await Submission.findByPk(submissionId);
      if (!submission) {
        res.status(404).json({ message: 'Сабмишен не найден' });
        return;
      }

      if (submission.userId === voterId) {
        res.status(400).json({ message: 'Нельзя голосовать за своё' });
        return;
      }

      const existing = await Vote.findOne({ where: { submissionId, voterId } });
      if (existing) {
        res.status(400).json({
          message: 'Ты уже голосовал за это доказательство',
          alreadyVoted: true,
          myScore: existing.score,
          myComment: existing.comment,
        });
        return;
      }

      await Vote.create({
        submissionId,
        voterId,
        score,
        isAnonymous: isAnonymous ?? false,
        comment: comment?.trim() || null,   // ✅ сохраняем комментарий
      });

      const allVotes = await Vote.findAll({ where: { submissionId } });
      const avgScore = allVotes.length > 0
        ? Math.round(
          allVotes.reduce((sum: number, v: Vote) => sum + v.score, 0) / allVotes.length * 100
        ) / 100
        : 0;

      await submission.update({ score: avgScore });

      const task = await Task.findByPk(submission.taskId);
      if (task) {
        const allTaskIds = await Task.findAll({
          where: { challengeId: task.challengeId },
          attributes: ['id'],
        });
        const taskIdList = allTaskIds.map((t) => t.id);

        const participantSubmissions = await Submission.findAll({
          where: { userId: submission.userId, taskId: taskIdList },
        });

        const totalScore = participantSubmissions.reduce(
          (sum, s) => sum + (s.score || 0), 0
        );

        await Participant.update(
          { score: totalScore },
          { where: { challengeId: task.challengeId, userId: submission.userId } }
        );

        await User.update(
          { rating: totalScore },
          { where: { id: submission.userId } }
        );
      }
      try {
        const voterUser = await User.findByPk(voterId, { attributes: ['username'] });
        const taskObj = await Task.findByPk(submission.taskId, { attributes: ['title'] });
        if (voterUser && taskObj && submission.userId !== voterId) {
          await notificationHelper.newVote(
            submission.userId,
            voterUser.username,
            score,
            submission.id,
            taskObj.title,
            isAnonymous ?? false
          );
        }
      } catch (_) { }

      res.json({

        message: 'Голос принят!',
        newScore: avgScore,
        voteCount: allVotes.length,
      });

    } catch (error) {
      console.error('Vote error:', error);
      res.status(500).json({ message: 'Ошибка голосования' });
    }
  },

  // Добавь в конец объекта voteController:
  getMyReceivedVotes: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Все сабмишены пользователя
      const submissions = await Submission.findAll({
        where: { userId },
        attributes: ['id', 'mediaUrl', 'mediaType', 'score', 'taskId'],
      });

      if (submissions.length === 0) {
        res.json([]);
        return;
      }

      const result = await Promise.all(
        submissions.map(async (sub) => {
          // Получаем задачу отдельно — без include чтобы избежать alias ошибок
          const task = await Task.findByPk(sub.taskId, {
            attributes: ['id', 'title', 'day'],
          });

          // Получаем голоса отдельно
          const votes = await Vote.findAll({
            where: { submissionId: sub.id },
            attributes: ['id', 'score', 'isAnonymous', 'voterId'],
          });

          // Для каждого голоса — получаем данные оценщика
          const votesWithVoters = await Promise.all(
            votes.map(async (v: Vote) => {
              if (v.isAnonymous) {
                return {
                  id: v.id,
                  score: v.score,
                  comment: v.comment || null,   // ✅
                  isAnonymous: v.isAnonymous,
                  voter: v.isAnonymous
                    ? { id: null, username: '🕵️ Анонимно', avatarUrl: null }
                    : (v as any).voter,
                };
              }

              const voter = await User.findByPk(v.voterId, {
                attributes: ['id', 'username', 'avatarUrl'],
              });

              return {
                id: v.id,
                score: v.score,
                isAnonymous: false,
                voter: voter
                  ? { id: voter.id, username: voter.username, avatarUrl: voter.avatarUrl }
                  : { id: null, username: 'Удалён', avatarUrl: null },
              };
            })
          );

          // Среднее по этому сабмишену
          const avg = votes.length > 0
            ? Math.round(
              votes.reduce((sum: number, v: Vote) => sum + v.score, 0) / votes.length * 100
            ) / 100
            : 0;

          return {
            submissionId: sub.id,
            mediaUrl: sub.mediaUrl,
            mediaType: sub.mediaType,
            task: task ? { id: task.id, title: task.title, day: task.day } : null,
            avgScore: avg,
            votes: votesWithVoters,
          };
        })
      );

      // Только те у которых есть голоса
      const withVotes = result.filter((r) => r.votes.length > 0);
      res.json(withVotes);

    } catch (error: any) {
      console.error('getMyReceivedVotes error:', error.message);
      res.status(500).json({ message: 'Ошибка: ' + error.message });
    }
  },

  // GET /api/votes/submission/:submissionId
  getBySubmission: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { submissionId } = req.params;
      const requesterId = req.user!.id;

      const votes = await Vote.findAll({
        where: { submissionId },
        include: [{
          model: User,
          as: 'voter',
          attributes: ['id', 'username', 'avatarUrl'],
        }],
        order: [['createdAt', 'DESC']],
      });

      const myVote = votes.find((v: Vote) => (v as any).voter?.id === requesterId);

      const safeVotes = votes.map((v: Vote) => {
        const voter = (v as any).voter;
        const isOwner = voter?.id === requesterId;

        return {
          id: v.id,
          score: v.score,
          comment: v.comment || null,    // ✅
          isAnonymous: v.isAnonymous,
          isMyVote: isOwner,
          voter: v.isAnonymous && !isOwner
            ? { id: null, username: '🕵️ Анонимно', avatarUrl: null }
            : voter,
        };
      });

      res.json({
        votes: safeVotes,
        myVote: myVote ? myVote.score : null,
        myComment: myVote ? myVote.comment : null,   // ✅
        totalVotes: votes.length,
        avgScore: votes.length > 0
          ? Math.round(
            votes.reduce((sum: number, v: Vote) => sum + v.score, 0) / votes.length * 100
          ) / 100
          : 0,
      });
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },

  // GET /api/votes/challenge/:challengeId/scoreboard
  getScoreboard: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { challengeId } = req.params;

      const participants = await Participant.findAll({
        where: { challengeId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'avatarUrl', 'rating', 'rikonCoins'],
        }],
        order: [['score', 'DESC']],
      });

      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },

  // GET /api/votes/global
  getGlobalRanking: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const users = await User.findAll({
        attributes: ['id', 'username', 'avatarUrl', 'rating', 'rikonCoins'],
        order: [['rating', 'DESC']],
        limit: 50,
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },

  // ==================================================================================================================================
  // PATCH /api/votes/:voteId  — изменение оценки и комментария
  updateVote: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { voteId } = req.params;
      const { score, comment, isAnonymous } = req.body;
      const userId = req.user!.id;

      const vote = await Vote.findByPk(voteId);
      if (!vote) {
        res.status(404).json({ message: 'Голос не найден' });
        return;
      }

      // Только автор может изменить
      if (vote.voterId !== userId) {
        res.status(403).json({ message: 'Нет прав' });
        return;
      }

      if (score && (score < 1 || score > 5)) {
        res.status(400).json({ message: 'Оценка должна быть от 1 до 5' });
        return;
      }

      await vote.update({
        score: score ?? vote.score,
        comment: comment !== undefined ? comment?.trim() || null : vote.comment,
        isAnonymous: isAnonymous ?? vote.isAnonymous,
      });

      // Пересчитываем средний score сабмишена
      const allVotes = await Vote.findAll({
        where: { submissionId: vote.submissionId },
      });

      const avgScore = allVotes.length > 0
        ? Math.round(
          allVotes.reduce((sum: number, v: Vote) => sum + v.score, 0) / allVotes.length * 100
        ) / 100
        : 0;

      await Submission.update(
        { score: avgScore },
        { where: { id: vote.submissionId } }
      );

      // Пересчитываем очки участника
      const submission = await Submission.findByPk(vote.submissionId);
      if (submission) {
        const task = await Task.findByPk(submission.taskId);
        if (task) {
          const allTaskIds = await Task.findAll({
            where: { challengeId: task.challengeId },
            attributes: ['id'],
          });
          const taskIdList = allTaskIds.map((t) => t.id);

          const participantSubmissions = await Submission.findAll({
            where: { userId: submission.userId, taskId: taskIdList },
          });

          const totalScore = participantSubmissions.reduce(
            (sum: number, s: Submission) => sum + (s.score || 0), 0
          );

          await Participant.update(
            { score: totalScore },
            { where: { challengeId: task.challengeId, userId: submission.userId } }
          );

          await User.update(
            { rating: totalScore },
            { where: { id: submission.userId } }
          );
        }
      }
      try {
        const voterUser = await User.findByPk(userId, { attributes: ['username'] });
        const subObj = await Submission.findByPk(vote.submissionId);
        if (subObj && voterUser && subObj.userId !== userId) {
          const taskObj = await Task.findByPk(subObj.taskId, { attributes: ['title'] });
          if (taskObj) {
            await notificationHelper.voteUpdated(
              subObj.userId,
              voterUser.username,
              score ?? vote.score,
              subObj.id,
              taskObj.title,
              isAnonymous ?? vote.isAnonymous
            );
          }
        }
      } catch (_) { }
      res.json({ message: 'Оценка обновлена!', newScore: avgScore });
    } catch (error: any) {
      console.error('updateVote error:', error.message);
      res.status(500).json({ message: 'Ошибка обновления' });
    }

  },

  // DELETE /api/votes/:voteId  — удаление оценки
  deleteVote: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { voteId } = req.params;
      const userId = req.user!.id;

      const vote = await Vote.findByPk(voteId);
      if (!vote) {
        res.status(404).json({ message: 'Голос не найден' });
        return;
      }

      if (vote.voterId !== userId) {
        res.status(403).json({ message: 'Нет прав' });
        return;
      }

      const { submissionId } = vote;
      await vote.destroy();

      // Пересчитываем средний score после удаления
      const allVotes = await Vote.findAll({ where: { submissionId } });

      const avgScore = allVotes.length > 0
        ? Math.round(
          allVotes.reduce((sum: number, v: Vote) => sum + v.score, 0) / allVotes.length * 100
        ) / 100
        : 0;

      await Submission.update(
        { score: avgScore },
        { where: { id: submissionId } }
      );

      // Пересчитываем очки участника
      const submission = await Submission.findByPk(submissionId);
      if (submission) {
        const task = await Task.findByPk(submission.taskId);
        if (task) {
          const allTaskIds = await Task.findAll({
            where: { challengeId: task.challengeId },
            attributes: ['id'],
          });
          const taskIdList = allTaskIds.map((t) => t.id);

          const participantSubmissions = await Submission.findAll({
            where: { userId: submission.userId, taskId: taskIdList },
          });

          const totalScore = participantSubmissions.reduce(
            (sum: number, s: Submission) => sum + (s.score || 0), 0
          );

          await Participant.update(
            { score: totalScore },
            { where: { challengeId: task.challengeId, userId: submission.userId } }
          );

          await User.update(
            { rating: totalScore },
            { where: { id: submission.userId } }
          );
        }
      }

      res.json({ message: 'Оценка удалена', newScore: avgScore });
    } catch (error: any) {
      console.error('deleteVote error:', error.message);
      res.status(500).json({ message: 'Ошибка удаления' });
    }
  },

};