import { Sequelize } from 'sequelize';
import { ENV } from './env';

const sequelize = new Sequelize(
  ENV.DB_NAME,
  ENV.DB_USER,
  ENV.DB_PASSWORD,
  {
    host: ENV.DB_HOST,
    port: ENV.DB_PORT,
    dialect: 'postgres',
    logging: ENV.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

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