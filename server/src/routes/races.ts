import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { config } from '../config.js';
import type { F1Race } from '../types/index.js';

const router = Router();

// GET / — all races for current season, ordered by round
router.get('/', (_req: Request, res: Response): void => {
  const races = db.prepare(`
    SELECT * FROM f1_races
    WHERE season = ?
    ORDER BY round ASC
  `).all(config.seasonYear) as F1Race[];

  res.json({ races });
});

// GET /next — next upcoming race
router.get('/next', (_req: Request, res: Response): void => {
  const race = db.prepare(`
    SELECT * FROM f1_races
    WHERE season = ? AND status IN ('upcoming', 'qualifying', 'in_progress')
    ORDER BY round ASC
    LIMIT 1
  `).get(config.seasonYear) as F1Race | undefined;

  if (!race) {
    res.json({ race: null });
    return;
  }

  res.json({ race });
});

// GET /:raceId — race detail with results
router.get('/:raceId', (req: Request, res: Response): void => {
  const raceId = parseInt(req.params.raceId, 10);

  const race = db.prepare('SELECT * FROM f1_races WHERE id = ?').get(raceId) as F1Race | undefined;

  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  const results = db.prepare(`
    SELECT rr.*, d.code, d.first_name, d.last_name, d.constructor_name
    FROM f1_race_results rr
    LEFT JOIN f1_drivers d ON d.driver_id = rr.driver_id
    WHERE rr.race_id = ?
    ORDER BY rr.session_type, rr.finish_position ASC
  `).all(raceId);

  res.json({ race, results });
});

// GET /:raceId/scores — all player scores for this race
router.get('/:raceId/scores', (req: Request, res: Response): void => {
  const raceId = parseInt(req.params.raceId, 10);

  const scores = db.prepare(`
    SELECT rs.*, u.display_name, u.username
    FROM race_scores rs
    JOIN users u ON u.id = rs.user_id
    WHERE rs.race_id = ?
    ORDER BY rs.total_points DESC
  `).all(raceId);

  res.json({ scores });
});

export default router;
