import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import driverRoutes from './routes/drivers.js';
import raceRoutes from './routes/races.js';
import teamRoutes from './routes/teams.js';
import pickRoutes from './routes/picks.js';
import standingsRoutes from './routes/standings.js';
import adminRoutes from './routes/admin.js';
import { initScheduler } from './jobs/scheduler.js';
import { syncSeasonData } from './services/f1DataSync.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/picks', pickRoutes);
app.use('/api/league', standingsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', season: config.seasonYear });
});

app.use(errorHandler);

runMigrations();

syncSeasonData().catch(err => console.error('Initial sync failed:', err));

initScheduler();

app.listen(config.port, () => {
  console.log(`F1 Fantasy server running on port ${config.port}`);
});

export default app;
