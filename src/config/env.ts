import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.PGHOST || process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.PGPORT || process.env.POSTGRES_PORT || process.env.DB_PORT) || 5432,
  DB_NAME: process.env.PGDATABASE || process.env.POSTGRES_DATABASE || process.env.DB_NAME || 'ba_challenge',
  DB_USER: process.env.PGUSER || process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',

  JWT_SECRET: process.env.JWT_SECRET || 'fallback_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
} as const;
