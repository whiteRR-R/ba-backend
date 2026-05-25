import { Sequelize } from 'sequelize';
import { ENV } from './env';

const useSSL = Boolean(ENV.DATABASE_URL) || ENV.NODE_ENV === 'production';

const commonConfig = {
  dialect: 'postgres' as const,
  logging: ENV.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: useSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : undefined,
};

const sequelize = ENV.DATABASE_URL
  ? new Sequelize(ENV.DATABASE_URL, commonConfig)
  : new Sequelize(ENV.DB_NAME, ENV.DB_USER, ENV.DB_PASSWORD, {
      ...commonConfig,
      host: ENV.DB_HOST,
      port: ENV.DB_PORT,
    });

export const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL подключён успешно');
    await sequelize.sync({ alter: true });
    // await sequelize.sync({ force: true });
    console.log('✅ Таблицы синхронизированы');
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error);
    process.exit(1);
  }
};

export default sequelize;
