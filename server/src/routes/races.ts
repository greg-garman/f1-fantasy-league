import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/connection.js';
import { config } from '../config.js';
import type { F1Race } from '../types/index.js';

const router = Router();

// GET / — all races for current season, ordered by round
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const races = await query<F1Race>(`
    SELECT * FROM f1_races
    WHERE season = $1
    ORDER BY round ASC
  `, [config.seasonYear]);

  res.json({ races });
});

// GET /next — next upcoming race
router.get('/next', async (_req: Request, res: Response): Promise<void> => {
  const race = await queryOne<F1Race>(`
    SELECT * FROM f1_races
    WHERE season = $1 AND status IN ('upcoming', 'qualifying', 'in_progress')
    ORDER BY round ASC
    LIMIT 1
  `, [config.seasonYear]);

  if (!race) {
    res.json({ race: null });
    return;
  }

  res.json({ race });
});

// GET /:raceId — race detail with results
router.get('/:raceId', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);

  const race = await queryOne<F1Race>('SELECT * FROM f1_races WHERE id = $1', [raceId]);

  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  const results = await query<any>(`
    SELECT rr.*, d.code, d.first_name, d.last_name, d.constructor_name
    FROM f1_race_results rr
    LEFT JOIN f1_drivers d ON d.driver_id = rr.driver_id
    WHERE rr.race_id = $1
    ORDER BY rr.session_type, rr.finish_position ASC
  `, [raceId]);

  res.json({ race, results });
});

// GET /:raceId/scores — all player scores for this race
router.get('/:raceId/scores', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);

  const scores = await query<any>(`
    SELECT rs.*, u.display_name, u.username
    FROM race_scores rs
    JOIN users u ON u.id = rs.user_id
    WHERE rs.race_id = $1
    ORDER BY rs.total_points DESC
  `, [raceId]);

  res.json({ scores });
});

export default router;
