import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import { Challenge, Participant, Task, Submission } from '../models';
import { aiService } from '../services/aiService';
import { ENV } from '../config/env';

const CHAT_CACHE_TTL_MS = 45_000;
const CHAT_CACHE_MAX_ITEMS = 300;
const chatCache = new Map<string, { reply: string; expiresAt: number }>();

const decodeUnicodeEscapes = (value: string): string =>
  value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );

const getFallbackChatReply = (language: 'ru' | 'kz' | 'en'): string => {
  if (language === 'kz') {
    return 'Белсенді челлендждер бойынша нақты дерек табылмады. Челлендж атауын нақтыласаңыз, қысқа әрі дәл жауап беремін.';
  }
  if (language === 'en') {
    return 'No detailed active challenge data was found in the current context. Specify a challenge name and I will return a short precise answer.';
  }
  return 'Подробные данные по активным челленджам в контексте не найдены. Уточни название челленджа, и я дам короткий точный ответ.';
};

const toTwoSentenceReply = (value: string, language: 'ru' | 'kz' | 'en'): string => {
  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const cleaned = sentences
    .map((s) =>
      s
        .replace(/^[*•\-–—\s"'`]+/, '')
        .replace(/[*•\-–—\s"'`]+$/, '')
        .trim()
    )
    .filter((s) => s.length > 1);

  if (!cleaned.length) return getFallbackChatReply(language);

  const selected = cleaned.slice(0, 2);
  if (selected.length >= 2) return selected.join(' ');

  const fallbackTail =
    language === 'kz'
      ? [
          'Челлендж атауын нақтылап берсеңіз, келесі қадамды бірден ұсынамын.',
          'Алдымен мерзімі жақын тапсырмалардан бастаған дұрыс.',
        ]
      : language === 'en'
      ? [
          'If you share a challenge name, I can suggest the next step immediately.',
          'It is best to start from tasks with the nearest deadlines.',
        ]
      : [
          'Уточни название челленджа, и я сразу подскажу следующий шаг.',
          'Лучше начать с задач с ближайшими дедлайнами.',
        ];

  while (selected.length < 2) {
    selected.push(fallbackTail[selected.length - cleaned.length] || fallbackTail[fallbackTail.length - 1]);
  }

  return selected.slice(0, 2).join(' ');
};

const normalizeChatReply = (raw: unknown, language: 'ru' | 'kz' | 'en'): string => {
  let text = String(raw ?? '').trim();
  if (!text) return getFallbackChatReply(language);

  // Sometimes model returns a JSON object/string as text; unwrap it first.
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') text = parsed;
      else if (parsed && typeof parsed.reply === 'string') text = parsed.reply;
      else if (parsed && typeof parsed.text === 'string') text = parsed.text;
    } catch {
      // keep original text
    }
  }

  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') text = parsed;
    } catch {
      // keep original text
    }
  }

  text = decodeUnicodeEscapes(text)
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/^[`'"*•\-–—\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return toTwoSentenceReply(text, language);
};

const buildChatCacheKey = (params: {
  userId: number;
  challengeId?: number;
  language: string;
  message: string;
}): string => {
  const normalizedMessage = params.message.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${params.userId}|${params.challengeId || 0}|${params.language}|${normalizedMessage}`;
};

const cleanupExpiredChatCache = () => {
  const now = Date.now();
  for (const [key, value] of chatCache.entries()) {
    if (value.expiresAt <= now) chatCache.delete(key);
  }
};

const setChatCache = (key: string, reply: string) => {
  cleanupExpiredChatCache();
  if (chatCache.size >= CHAT_CACHE_MAX_ITEMS) {
    const firstKey = chatCache.keys().next().value;
    if (firstKey) chatCache.delete(firstKey);
  }
  chatCache.set(key, { reply, expiresAt: Date.now() + CHAT_CACHE_TTL_MS });
};

const normalizeLanguage = (language: string = 'ru'): 'ru' | 'kz' | 'en' => {
  const lang = String(language || 'ru').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('kz') || lang.startsWith('kk')) return 'kz';
  return 'ru';
};

type ChatIntent = 'statuses' | 'overdue' | 'next_step' | 'deadlines_week' | 'lowest_progress' | 'unknown';

const detectChatIntent = (message: string): ChatIntent => {
  const text = String(message || '').toLowerCase();

  if (/(статус|active challenge|активн|белсенд)/i.test(text)) return 'statuses';
  if (/(просроч|мерзімінен өткен|overdue)/i.test(text)) return 'overdue';
  if (/(следующ|келесі|next step|прогресс)/i.test(text)) return 'next_step';
  if (/(дедлайн|deadline|апта|week)/i.test(text)) return 'deadlines_week';
  if (/(самый низкий|ең төмен|lowest|progress)/i.test(text)) return 'lowest_progress';

  return 'unknown';
};

const formatDateShort = (date: Date | string, language: 'ru' | 'kz' | 'en'): string => {
  const d = new Date(date);
  const locale = language === 'kz' ? 'kk-KZ' : language === 'en' ? 'en-US' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(d);
};

const clampName = (value: string, max = 32): string => {
  const v = String(value || '').trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}...`;
};

const buildDeterministicReply = (params: {
  language: 'ru' | 'kz' | 'en';
  message: string;
  now: Date;
  challenges: any[];
  tasks: any[];
  submittedTaskSet: Set<number>;
  challengeStats: Array<{ id: number; title: string; status: string; totalTasks: number; completedTasks: number }>;
}): string | null => {
  const { language, message, now, challenges, tasks, submittedTaskSet, challengeStats } = params;
  const intent = detectChatIntent(message);

  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);

  if (intent === 'statuses') {
    const active = challenges.filter((c: any) => c.status === 'active');
    if (!active.length) {
      return language === 'kz'
        ? 'Сізде қазір белсенді челлендж жоқ. Жақын дедлайны бар тапсырма да табылмады.'
        : language === 'en'
        ? 'You currently have no active challenges. No near-term deadlines were found.'
        : 'У вас сейчас нет активных челленджей. Ближайшие дедлайны не найдены.';
    }

    const top = active
      .map((c: any) => {
        const st = challengeStats.find((x) => x.id === c.id);
        const progress = st ? `${st.completedTasks}/${st.totalTasks}` : '0/0';
        return `${clampName(c.title)} (${progress})`;
      })
      .slice(0, 2)
      .join(', ');

    return language === 'kz'
      ? `Сізде ${active.length} белсенді челлендж бар: ${top}. Алдымен үлгерімі төмен челленджден бастасаңыз, прогресс тезірек өседі.`
      : language === 'en'
      ? `You have ${active.length} active challenges: ${top}. Start with the one with lower progress to improve results faster.`
      : `У вас ${active.length} активных челленджа: ${top}. Начните с челленджа с меньшим прогрессом, чтобы быстрее улучшить результат.`;
  }

  if (intent === 'overdue') {
    const overdue = tasks
      .filter((t: any) => t.deadline && new Date(t.deadline) < now && !submittedTaskSet.has(t.id))
      .slice(0, 2);

    if (!overdue.length) {
      return language === 'kz'
        ? 'Мерзімі өткен тапсырмалар жоқ. Ең жақын дедлайндары бар тапсырмаларға назар аударыңыз.'
        : language === 'en'
        ? 'You have no overdue tasks right now. Focus on tasks with the nearest deadlines.'
        : 'Сейчас у вас нет просроченных задач. Сфокусируйтесь на задачах с ближайшими дедлайнами.';
    }

    const list = overdue
      .map((t: any) => `${clampName(t.title)} (${formatDateShort(t.deadline, language)})`)
      .join(', ');

    return language === 'kz'
      ? `Сізде ${overdue.length} мерзімі өткен тапсырма бар: ${list}. Алдымен оларды жабыңыз, сонда жалпы прогресс тұрақтанады.`
      : language === 'en'
      ? `You have ${overdue.length} overdue tasks: ${list}. Complete these first to stabilize your overall progress.`
      : `У вас ${overdue.length} просроченных задачи: ${list}. Закройте их в первую очередь, чтобы стабилизировать общий прогресс.`;
  }

  if (intent === 'deadlines_week') {
    const near = tasks
      .filter((t: any) => {
        if (!t.deadline || submittedTaskSet.has(t.id)) return false;
        const d = new Date(t.deadline);
        return d >= now && d <= weekLater;
      })
      .slice(0, 3);

    if (!near.length) {
      return language === 'kz'
        ? 'Осы аптада жақын дедлайндар жоқ. Қазір жоспарды жай темппен орындауға болады.'
        : language === 'en'
        ? 'There are no near deadlines this week. You can keep a steady pace now.'
        : 'На этой неделе близких дедлайнов нет. Сейчас можно двигаться в спокойном темпе.';
    }

    const list = near
      .map((t: any) => `${clampName(t.title)} (${formatDateShort(t.deadline, language)})`)
      .join(', ');

    return language === 'kz'
      ? `Осы аптада ${near.length} жақын дедлайн бар: ${list}. Бірінші болып мерзімі ең ерте тапсырманы орындаңыз.`
      : language === 'en'
      ? `You have ${near.length} near deadlines this week: ${list}. Complete the earliest one first.`
      : `На этой неделе у вас ${near.length} близких дедлайна: ${list}. Сначала выполните задачу с самой ранней датой.`;
  }

  if (intent === 'lowest_progress' || intent === 'next_step') {
    const withTasks = challengeStats.filter((c) => c.totalTasks > 0);
    if (!withTasks.length) {
      return language === 'kz'
        ? 'Тапсырмасы бар челлендж табылмады. Алдымен челленджге тапсырма қосыңыз немесе жаңасын таңдаңыз.'
        : language === 'en'
        ? 'No challenge with tasks was found. Add tasks first or choose another challenge.'
        : 'Не найден челлендж с задачами. Сначала добавьте задачи или выберите другой челлендж.';
    }

    const sorted = [...withTasks].sort((a, b) => {
      const ap = a.completedTasks / Math.max(1, a.totalTasks);
      const bp = b.completedTasks / Math.max(1, b.totalTasks);
      return ap - bp;
    });
    const lowest = sorted[0];
    const percent = Math.round((lowest.completedTasks / Math.max(1, lowest.totalTasks)) * 100);

    return language === 'kz'
      ? `Ең төмен прогресс "${clampName(lowest.title)}" челленджінде: ${lowest.completedTasks}/${lowest.totalTasks} (${percent}%). Келесі қадам ретінде осы челлендждегі ең жақын дедлайны бар тапсырманы бүгін жабыңыз.`
      : language === 'en'
      ? `Your lowest progress is in "${clampName(lowest.title)}": ${lowest.completedTasks}/${lowest.totalTasks} (${percent}%). As a next step, complete the nearest-deadline task in this challenge today.`
      : `Самый низкий прогресс в челлендже "${clampName(lowest.title)}": ${lowest.completedTasks}/${lowest.totalTasks} (${percent}%). Следующим шагом закройте сегодня задачу с ближайшим дедлайном в этом челлендже.`;
  }

  return null;
};

export const aiController = {
  listModels: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await import('@google/generative-ai');

      // @ts-ignore
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${ENV.ANTHROPIC_API_KEY}`
      );
      const data = (await response.json()) as any;

      const usable = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name);

      res.json({ available_models: usable });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },

  generateTasks: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { challengeId, taskCount, language } = req.body;

      if (!taskCount || taskCount < 1) {
        res.status(400).json({ message: 'Укажи количество задач' });
        return;
      }

      const challenge = await Challenge.findByPk(challengeId);
      if (!challenge) {
        res.status(404).json({ message: 'Челлендж не найден' });
        return;
      }

      const plan = await aiService.generateTasks(
        challenge.title,
        challenge.description,
        challenge.startDate.toString(),
        challenge.endDate.toString(),
        Number(taskCount),
        normalizeLanguage(language)
      );

      await Task.destroy({ where: { challengeId, isAiGenerated: true } });

      const savedTasks = await Task.bulkCreate(
        plan.tasks.map((t, i) => ({
          challengeId,
          title: t.title,
          description: t.description,
          day: i + 1,
          deadline: new Date(t.deadline),
          isAiGenerated: true,
        }))
      );

      res.json({ tasks: savedTasks, summary: plan.summary });
    } catch (error: any) {
      console.error('AI generateTasks error:', error.message);
      res.status(500).json({ message: 'Ошибка генерации: ' + error.message });
    }
  },

  evaluateSubmission: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { submissionId } = req.params;
      const { language } = req.body;

      const submission = await Submission.findByPk(submissionId);

      if (!submission) {
        res.status(404).json({ message: 'Сабмишен не найден' });
        return;
      }

      const task = await Task.findByPk(submission.taskId);
      if (!task) {
        res.status(404).json({ message: 'Задача для сабмишена не найдена' });
        return;
      }

      const evaluation = await aiService.evaluateSubmission(
        task.title,
        task.description,
        submission.mediaUrl,
        submission.mediaType,
        normalizeLanguage(language)
      );

      await submission.update({
        aiScore: evaluation.score,
        aiComment: evaluation.comment,
        score: evaluation.score,
      });

      res.json(evaluation);
    } catch (error: any) {
      console.error('AI evaluate error:', error.message);
      res.status(500).json({ message: 'Ошибка AI оценки: ' + error.message });
    }
  },

  chat: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { message, challengeId, language } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: 'Пользователь не авторизован' });
        return;
      }
      if (!String(message || '').trim()) {
        res.status(400).json({ message: 'Пустой запрос' });
        return;
      }

      const normalizedLanguage = normalizeLanguage(language);
      const cacheKey = buildChatCacheKey({
        userId,
        challengeId: challengeId ? Number(challengeId) : undefined,
        language: normalizedLanguage,
        message: String(message || ''),
      });
      const cached = chatCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ reply: cached.reply, cached: true });
        return;
      }
      const now = new Date();
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);

      const participations = await Participant.findAll({
        where: { userId },
        attributes: ['challengeId'],
        limit: 20,
      });
      const challengeIds = participations.map((p: any) => p.challengeId);

      if (challengeIds.length === 0) {
        const emptyReply =
          normalizedLanguage === 'kz'
            ? 'Сіз әлі ешбір челленджге қосылмағансыз.'
            : normalizedLanguage === 'en'
            ? 'You are not participating in any challenges yet.'
            : 'Вы пока не участвуете ни в одном челлендже.';
        res.json({ reply: emptyReply });
        return;
      }

      const challengeWhere: any = { id: { [Op.in]: challengeIds } };
      if (challengeId) challengeWhere.id = Number(challengeId);

      const challenges = await Challenge.findAll({
        where: challengeWhere,
        attributes: ['id', 'title', 'status', 'startDate', 'endDate'],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      });

      const selectedChallengeIds = challenges.map((c: any) => c.id);

      const tasks = await Task.findAll({
        where: {
          challengeId: { [Op.in]: selectedChallengeIds },
        },
        attributes: ['id', 'challengeId', 'title', 'deadline', 'day'],
        order: [['deadline', 'ASC']],
        limit: 80,
      });

      const taskIds = tasks.map((t: any) => t.id);

      const submissions = taskIds.length
        ? await Submission.findAll({
            where: {
              userId,
              taskId: { [Op.in]: taskIds },
            },
            attributes: ['taskId', 'createdAt', 'score', 'aiScore'],
            order: [['createdAt', 'DESC']],
            limit: 120,
          })
        : [];

      const submittedTaskSet = new Set(submissions.map((s: any) => s.taskId));

      const overdueTasks = tasks
        .filter((t: any) => t.deadline && new Date(t.deadline) < now && !submittedTaskSet.has(t.id))
        .slice(0, 8)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          challengeId: t.challengeId,
        }));

      const upcomingTasks = tasks
        .filter((t: any) => {
          if (!t.deadline) return false;
          const d = new Date(t.deadline);
          return d >= now && d <= weekLater;
        })
        .slice(0, 10)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          challengeId: t.challengeId,
          submitted: submittedTaskSet.has(t.id),
        }));

      const challengeStats = challenges.map((c: any) => {
        const cTasks = tasks.filter((t: any) => t.challengeId === c.id);
        const done = cTasks.filter((t: any) => submittedTaskSet.has(t.id)).length;
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          totalTasks: cTasks.length,
          completedTasks: done,
        };
      });

      const compactContext = {
        userId,
        now: now.toISOString().slice(0, 10),
        challengeCount: challengeStats.length,
        challengeStats: challengeStats.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          progress: `${c.completedTasks}/${c.totalTasks}`,
        })),
        overdueCount: overdueTasks.length,
        overdueTasks: overdueTasks.slice(0, 3).map((t) => ({
          title: t.title,
          deadline: t.deadline,
        })),
        upcomingWeekCount: upcomingTasks.length,
        upcomingTasks: upcomingTasks.slice(0, 4).map((t) => ({
          title: t.title,
          deadline: t.deadline,
          submitted: t.submitted,
        })),
      };

      const deterministicReply = buildDeterministicReply({
        language: normalizedLanguage,
        message: String(message || ''),
        now,
        challenges,
        tasks,
        submittedTaskSet,
        challengeStats,
      });

      let cleanReply: string;
      if (deterministicReply) {
        cleanReply = normalizeChatReply(deterministicReply, normalizedLanguage);
      } else {
        const reply = await aiService.chat(
          message,
          JSON.stringify(compactContext),
          normalizedLanguage
        );
        cleanReply = normalizeChatReply(reply, normalizedLanguage);
      }

      setChatCache(cacheKey, cleanReply);
      res.json({ reply: cleanReply, cached: false });
    } catch (error: any) {
      console.error('AI chat error:', error.message);

      if (error.message?.includes('429')) {
        res.status(503).json({
          message: 'AI перегружен, попробуй через минуту ⏳',
        });
      } else if (String(error.message || '').toLowerCase().includes('timeout')) {
        res.status(504).json({
          message: 'AI долго отвечает, попробуй снова через пару секунд.',
        });
      } else {
        res.status(500).json({
          message: 'AI недоступен: ' + error.message?.slice(0, 100),
        });
      }
    }
  },
};
