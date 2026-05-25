import { cleanupCompletedChallenges } from './cleanupFiles';

/**
 * Запускает плановую очистку файлов каждые 24 часа.
 * Вызвать один раз при старте сервера в src/index.ts:
 *   import { startScheduler } from './utils/scheduler';
 *   startScheduler();
 */
export const startScheduler = (): void => {
    const INTERVAL_MS = 24 * 60 * 60 * 1000; // каждые 24 часа

    console.log('⏰ Планировщик очистки файлов запущен (каждые 24 часа)');

    // Первый запуск через 1 минуту после старта сервера
    setTimeout(async () => {
        await cleanupCompletedChallenges(0);

        // Затем каждые 24 часа
        setInterval(async () => {
            await cleanupCompletedChallenges(0);
        }, INTERVAL_MS);

    }, 60 * 1000);
};