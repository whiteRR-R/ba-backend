import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Создаём папки если не существуют
const createDirIfNotExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

createDirIfNotExists('uploads/photos');
createDirIfNotExists('uploads/videos');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Фото и видео в разные папки
        const isVideo = file.mimetype.startsWith('video/');
        const folder = isVideo ? 'uploads/videos' : 'uploads/photos';
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        // Уникальное имя файла: uuid + оригинальное расширение
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Неподдерживаемый тип файла'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB максимум
    },
});