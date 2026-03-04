import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'fantasy.db'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  f1ApiBase: process.env.F1_API_BASE || 'https://api.jolpi.ca/ergast/f1',
  seasonYear: parseInt(process.env.SEASON_YEAR || '2026', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  budgetCap: 100.0,
  teamSize: 5,
  freeTransfersPerRace: 2,
  extraTransferPenalty: 10,
};
