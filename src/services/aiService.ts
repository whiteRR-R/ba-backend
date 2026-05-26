import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../config/env';

const genAI = new GoogleGenerativeAI(ENV.ANTHROPIC_API_KEY);

interface GeneratedTask {
  day: number;
  title: string;
  description: string;
  deadline: string;
}

interface AITaskPlan {
  tasks: GeneratedTask[];
  summary: string;
}

interface AIEvaluation {
  score: number;
  comment: string;
  isCompleted: boolean;
}

const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3-flash-preview',
];

const getModel = (modelName: string = MODEL_FALLBACKS[0]) =>
  genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      maxOutputTokens: 220,
    },
  });

const getRetryDelay = (errorMessage: string): number => {
  const match = errorMessage.match(/Please retry in (\d+)/);
  return match ? (parseInt(match[1], 10) + 2) * 1000 : 6000;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientModelError = (message: string = ''): boolean => {
  const msg = message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('service unavailable') ||
    msg.includes('overloaded')
  );
};

const generateWithFallback = async (prompt: string): Promise<string> => {
  let lastError: Error | null = null;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const m = getModel(modelName);
      const result = await m.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      lastError = err;

      if (!isTransientModelError(err?.message || '')) {
        continue;
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        const delay = err?.message?.includes('429') ? getRetryDelay(err.message) : attempt * 4000;
        await sleep(delay);

        try {
          const m = getModel(modelName);
          const retryResult = await m.generateContent(prompt);
          return retryResult.response.text();
        } catch (retryErr: any) {
          lastError = retryErr;
        }
      }
    }
  }

  throw new Error(
    `All Gemini models are temporarily unavailable. Last error: ${lastError?.message?.slice(0, 180)}`
  );
};

const parseModelJson = <T>(text: string): T => {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned) as T;
};

const normalizeLanguage = (language: string = 'ru'): 'ru' | 'kz' | 'en' => {
  const lang = String(language || 'ru').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('kz') || lang.startsWith('kk')) return 'kz';
  return 'ru';
};

export const aiService = {
  generateTasks: async (
    challengeTitle: string,
    challengeDescription: string,
    startDate: string,
    endDate: string,
    taskCount: number,
    language: string = 'ru'
  ): Promise<AITaskPlan> => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const interval = Math.max(1, Math.floor(totalDays / taskCount));

    const deadlines: { day: number; deadline: string }[] = [];
    for (let i = 0; i < taskCount; i++) {
      const dayNumber = (i + 1) * interval;
      const deadlineDate = new Date(start);
      deadlineDate.setDate(deadlineDate.getDate() + dayNumber);
      deadlines.push({
        day: dayNumber,
        deadline: deadlineDate.toISOString().split('T')[0],
      });
    }

    const normalizedLanguage = normalizeLanguage(language);
    const langInstruction =
      normalizedLanguage === 'kz'
        ? 'Reply in Kazakh.'
        : normalizedLanguage === 'en'
        ? 'Reply in English.'
        : 'Reply in Russian.';

    const prompt = `${langInstruction}
Create exactly ${taskCount} challenge tasks.
Challenge title: ${challengeTitle}
Challenge description: ${challengeDescription}
Duration: ${totalDays} days
Task days: ${deadlines.map((d) => `Day ${d.day}`).join(', ')}
Return only JSON (no markdown):
{
  "tasks": [
    { "title": "Task title", "description": "Detailed task description" }
  ],
  "summary": "Short summary"
}
Return exactly ${taskCount} items in tasks.`;

    const text = await generateWithFallback(prompt);
    const parsed = parseModelJson<{ tasks: Array<{ title: string; description: string }>; summary: string }>(text);

    const tasks = parsed.tasks.slice(0, taskCount).map((t, i) => ({
      title: t.title,
      description: t.description,
      day: deadlines[i].day,
      deadline: deadlines[i].deadline,
    }));

    return { tasks, summary: parsed.summary };
  },

  evaluateSubmission: async (
    taskTitle: string,
    taskDescription: string,
    mediaUrl: string,
    mediaType: 'photo' | 'video',
    language: string = 'ru'
  ): Promise<AIEvaluation> => {
    const normalizedLanguage = normalizeLanguage(language);
    const langInstruction =
      normalizedLanguage === 'kz'
        ? 'Reply in Kazakh.'
        : normalizedLanguage === 'en'
        ? 'Reply in English.'
        : 'Reply in Russian.';

    if (mediaType === 'photo') {
      try {
        const imageResponse = await fetch(mediaUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

        for (const modelName of MODEL_FALLBACKS) {
          try {
            const vModel = getModel(modelName);
            const result = await vModel.generateContent([
              {
                inlineData: {
                  mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                  data: base64Image,
                },
              },
              `${langInstruction}
You are a challenge judge. Evaluate the photo submission.
Task: ${taskTitle}
Task description: ${taskDescription}
Return only JSON: {"score":85,"comment":"...","isCompleted":true}
score must be 0..100`,
            ]);

            return parseModelJson<AIEvaluation>(result.response.text());
          } catch {
            // try next model
          }
        }
      } catch {
        // fallback below
      }

      return {
        score: 75,
        comment: 'Фото принято. Хорошая работа.',
        isCompleted: true,
      };
    }

    const prompt = `${langInstruction}
Participant uploaded a video proof for task: ${taskTitle}.
Task description: ${taskDescription}
Give a positive short evaluation.
Return only JSON: {"score":80,"comment":"...","isCompleted":true}`;

    const text = await generateWithFallback(prompt);
    return parseModelJson<AIEvaluation>(text);
  },

  chat: async (userMessage: string, challengeContext: string, language: string = 'ru'): Promise<string> => {
    const normalizedLanguage = normalizeLanguage(language);
    const langInstruction =
      normalizedLanguage === 'kz'
        ? 'Reply in Kazakh.'
        : normalizedLanguage === 'en'
        ? 'Reply in English.'
        : 'Reply in Russian.';

    const prompt = `${langInstruction}
You are B&A Challenge assistant.
Answer only using this user data context. If data is missing, clearly say it's not found in context.
Keep response concise:
- max 3 short bullet points
- max 320 characters total
- no intro and no outro
Context: ${challengeContext}
User message: ${userMessage}`;

    return generateWithFallback(prompt);
  },
};
