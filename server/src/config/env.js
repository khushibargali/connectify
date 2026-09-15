import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const DEFAULT_SECRET = 'dev-only-secret-change-me';

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000, // 5000 is taken by AirPlay Receiver on macOS
  MONGO_URI: process.env.MONGO_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  SEED_DEMO: process.env.SEED_DEMO === 'true',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS) || 10,
  UPLOAD_DIR: process.env.UPLOAD_DIR || '',
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 25,
});

if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEFAULT_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

export default env;
