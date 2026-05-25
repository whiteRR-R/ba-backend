import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-cbc';
// Ключ берём из env, или генерируем фоллбэк (лучше задать в .env)
const SECRET_KEY = process.env.FILE_ENCRYPTION_KEY
    ? Buffer.from(process.env.FILE_ENCRYPTION_KEY, 'hex')
    : crypto.scryptSync('ba_challenge_secret_2024', 'salt_ba', 32);

/**
 * Шифрует файл и сохраняет как .enc
 * Возвращает путь к зашифрованному файлу
 */
export const encryptFile = (inputPath: string): string => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

    const inputBuffer = fs.readFileSync(inputPath);
    const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);

    // Сохраняем IV в начале файла (первые 16 байт) + зашифрованные данные
    const outputBuffer = Buffer.concat([iv, encrypted]);

    const encPath = inputPath + '.enc';
    fs.writeFileSync(encPath, outputBuffer);

    // Удаляем оригинальный незашифрованный файл
    fs.unlinkSync(inputPath);

    return encPath;
};

/**
 * Расшифровывает файл и возвращает Buffer с данными
 */
export const decryptFile = (encPath: string): Buffer => {
    const fileBuffer = fs.readFileSync(encPath);

    // Первые 16 байт — это IV
    const iv = fileBuffer.subarray(0, 16);
    const encryptedData = fileBuffer.subarray(16);

    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    return decrypted;
};

/**
 * Удаляет зашифрованный файл с диска
 */
export const deleteEncryptedFile = (encPath: string): void => {
    try {
        if (fs.existsSync(encPath)) {
            fs.unlinkSync(encPath);
            console.log(`🗑️ Файл удалён: ${encPath}`);
        }
    } catch (err: any) {
        console.error(`❌ Ошибка удаления файла ${encPath}:`, err.message);
    }
};

/**
 * Получает MIME-тип по расширению файла (без .enc)
 */
export const getMimeType = (filePath: string): string => {
    // Убираем .enc чтобы получить оригинальное расширение
    const cleanPath = filePath.replace(/\.enc$/, '');
    const ext = path.extname(cleanPath).toLowerCase();

    const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
    };

    return mimeMap[ext] || 'application/octet-stream';
};