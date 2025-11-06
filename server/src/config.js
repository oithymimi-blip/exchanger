import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_change_me';
export const DB_FILE = process.env.DB_FILE || './data.db';
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin#12345';
const parsedInitialBalance = Number(process.env.INITIAL_BALANCE);
export const INITIAL_BALANCE = Number.isFinite(parsedInitialBalance) && parsedInitialBalance > 0
  ? parsedInitialBalance
  : 10000;
