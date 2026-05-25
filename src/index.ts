import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { ENV } from './config/env';
import { connectDB } from './config/database';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { startScheduler } from './utils/scheduler'; // ✅ добавили

// Импортируем модели чтобы они зарегистрировались в Sequelize
import './models';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Статика — только для старых файлов без шифрования
// Новые файлы (.enc) недоступны напрямую — только через /api/submissions/:id/media
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'B&A Challenge API is running',
    docs: '/api',
    health: '/health',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'B&A Challenge API работает ✅',
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();

    // ✅ Запускаем планировщик очистки файлов
    startScheduler();

    app.listen(ENV.PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${ENV.PORT}`);
      console.log(`📡 API: http://localhost:${ENV.PORT}/api`);
      console.log(`❤️  Health: http://localhost:${ENV.PORT}/health`);
      console.log(`📁 Static: http://localhost:${ENV.PORT}/uploads`);
      console.log(`🔐 Медиа через защищённый endpoint: /api/submissions/:id/media`);
    });
  } catch (error) {
    console.error('❌ Не удалось запустить сервер:', error);
    process.exit(1);
  }
};

startServer();
