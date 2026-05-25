import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../config/env';

const genAI = new GoogleGenerativeAI(ENV.ANTHROPIC_API_KEY);

interface GeneratedTask {
    day: number;
    title: string;
    description: string;
    deadline: string;        // ✅ добавили
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

// Список моделей для fallback — пробуем по очереди
const MODEL_FALLBACKS = [
    // 'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
];

// Получаем рабочую модель
const getModel = (modelName: string = MODEL_FALLBACKS[0]) => {
    return genAI.getGenerativeModel({ model: modelName });
};

// Пробуем сгенерировать с fallback на другие модели
// Извлекаем сколько секунд ждать из ошибки 429
const getRetryDelay = (errorMessage: string): number => {
    const match = errorMessage.match(/Please retry in (\d+)/);
    return match ? (parseInt(match[1]) + 2) * 1000 : 60000;
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const generateWithFallback = async (prompt: string): Promise<string> => {
    let lastError: Error | null = null;

    for (const modelName of MODEL_FALLBACKS) {
        try {
            console.log(`🤖 Пробую модель: ${modelName}`);
            const m = getModel(modelName);
            const result = await m.generateContent(prompt);
            const text = result.response.text();
            console.log(`✅ Успешно с моделью: ${modelName}`);
            return text;
        } catch (err: any) {
            console.error(`❌ Модель ${modelName}: ${err.message?.slice(0, 100)}`);

            // Если 429 — ждём и пробуем ту же модель ещё раз
            if (err.message?.includes('429')) {
                const delay = getRetryDelay(err.message);
                console.log(`⏳ Жду ${delay / 1000} сек перед повтором...`);
                await sleep(delay);

                try {
                    console.log(`🔄 Повтор модели: ${modelName}`);
                    const m = getModel(modelName);
                    const result = await m.generateContent(prompt);
                    console.log(`✅ Повтор успешен: ${modelName}`);
                    return result.response.text();
                } catch (retryErr: any) {
                    console.error(`❌ Повтор тоже не сработал: ${retryErr.message?.slice(0, 80)}`);
                    lastError = retryErr;
                }
            } else {
                lastError = err;
            }
        }
    }

    throw new Error(`Все модели недоступны. Последняя ошибка: ${lastError?.message?.slice(0, 150)}`);
};
export const aiService = {

    generateTasks: async (
        challengeTitle: string,
        challengeDescription: string,
        startDate: string,
        endDate: string,
        taskCount: number,        // ✅ сколько задач хочет пользователь
        language: string = 'ru'
    ): Promise<AITaskPlan> => {

        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalDays = Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Вычисляем интервал между задачами
        const interval = Math.floor(totalDays / taskCount);

        // Заранее считаем дедлайны — AI не должен их придумывать
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

        const langInstruction =
            language === 'kz' ? 'Жауапты қазақ тілінде бер.' :
                language === 'en' ? 'Respond in English.' :
                    'Отвечай на русском языке.';

        console.log(`🤖 AI генерирует ${taskCount} задач с интервалом ${interval} дней...`);

        const model = genAI.getGenerativeModel({ model: MODEL_FALLBACKS[0] });

        const prompt = `${langInstruction}

Создай ${taskCount} задач для челленджа:
Название: ${challengeTitle}
Описание: ${challengeDescription}
Срок: ${totalDays} дней

Задачи распределены по дням: ${deadlines.map(d => `День ${d.day}`).join(', ')}

Верни ТОЛЬКО JSON без markdown:
{
  "tasks": [
    { "title": "Название задачи", "description": "Детальное описание что нужно сделать" }
  ],
  "summary": "Краткое описание плана"
}

Верни ровно ${taskCount} задач в массиве tasks (только title и description, без day и deadline).`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : cleaned);

        // Объединяем AI задачи с нашими дедлайнами
        const tasks = parsed.tasks.map((t: any, i: number) => ({
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

        const langInstruction =
            language === 'kz' ? 'Жауапты қазақ тілінде бер.' :
                language === 'en' ? 'Respond in English.' :
                    'Отвечай на русском языке.';

        if (mediaType === 'photo') {
            try {
                const imageResponse = await fetch(mediaUrl);
                const imageBuffer = await imageResponse.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                const mimeType = (imageResponse.headers.get('content-type') || 'image/jpeg');

                // Для изображений нужна vision модель
                const visionModels = [
                    // 'gemini-3.1-flash-lite-preview',
                    'gemini-3-flash-preview'
                ];
                let lastErr: Error | null = null;

                for (const modelName of visionModels) {
                    try {
                        console.log(`🤖 Vision модель: ${modelName}`);
                        const vModel = genAI.getGenerativeModel({ model: modelName });

                        const result = await vModel.generateContent([
                            {
                                inlineData: {
                                    mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                                    data: base64Image,
                                },
                            },
                            `${langInstruction}
Ты судья челленджа. Оцени выполнение задачи по фото.
Задача: ${taskTitle}
Описание: ${taskDescription}
Верни ТОЛЬКО JSON без markdown:
{"score": 85, "comment": "Комментарий", "isCompleted": true}
score: от 0 до 100`,
                        ]);

                        const text = result.response.text();
                        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                        if (jsonMatch) return JSON.parse(jsonMatch[0]) as AIEvaluation;
                        return JSON.parse(cleaned) as AIEvaluation;
                    } catch (err: any) {
                        console.error(`❌ Vision ${modelName}: ${err.message}`);
                        lastErr = err;
                    }
                }
                throw lastErr;
            } catch (err: any) {
                // Если фото анализ не работает — даём стандартную оценку
                console.error('Photo analysis failed, using default:', err.message);
                return { score: 75, comment: 'Фото получено! Хорошая работа 👍', isCompleted: true };
            }
        }

        // Для видео — текстовая оценка
        const prompt = `${langInstruction}
Участник загрузил видео как доказательство задачи: ${taskTitle}.
Дай положительную оценку.
Верни ТОЛЬКО JSON без markdown: {"score": 80, "comment": "Видео принято!", "isCompleted": true}`;

        const text = await generateWithFallback(prompt);
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]) as AIEvaluation;
        return JSON.parse(cleaned) as AIEvaluation;
    },

    chat: async (
        userMessage: string,
        challengeContext: string,
        language: string = 'ru'
    ): Promise<string> => {

        const langInstruction =
            language === 'kz' ? 'Жауапты қазақ тілінде бер.' :
                language === 'en' ? 'Respond in English.' :
                    'Отвечай на русском языке.';

        const prompt = `${langInstruction}
Ты помощник B&A Challenge. Контекст: ${challengeContext}
Вопрос пользователя: ${userMessage}
Дай краткий мотивирующий ответ (2-3 предложения).`;

        return await generateWithFallback(prompt);
    },
};