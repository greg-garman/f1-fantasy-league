import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import { config } from '../config.js';

const router = Router();

// GET /standings — overall standings
router.get('/standings', (_req: Request, res: Response): void => {
  // Get all users with total scores
  const standings = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.budget,
           COALESCE(SUM(rs.total_points), 0) as total_points,
           COALESCE(SUM(rs.team_points), 0) as total_team_points,
           COALESCE(SUM(rs.picks_points), 0) as total_picks_points,
           COALESCE(SUM(rs.manual_adjustment), 0) as total_adjustments
    FROM users u
    LEFT JOIN race_scores rs ON rs.user_id = u.id
    GROUP BY u.id
    ORDER BY total_points DESC
  `).all();

  // Get race-by-race breakdown for each user
  const raceBreakdowns = db.prepare(`
    SELECT rs.user_id, rs.race_id, rs.team_points, rs.picks_points, rs.total_points,
           rs.manual_adjustment, fr.round, fr.race_name
    FROM race_scores rs
    JOIN f1_races fr ON fr.id = rs.race_id
    ORDER BY fr.round ASC
  `).all() as any[];

  const breakdownByUser = new Map<number, any[]>();
  for (const row of raceBreakdowns) {
    const list = breakdownByUser.get(row.user_id) ?? [];
    list.push(row);
    breakdownByUser.set(row.user_id, list);
  }

  const result = (standings as any[]).map((s, index) => ({
    ...s,
    rank: index + 1,
    races: breakdownByUser.get(s.id) ?? [],
  }));

  res.json({ standings: result });
});

// GET /standings/:raceId — standings as of a specific race
router.get('/standings/:raceId', (req: Request, res: Response): void => {
  const raceId = parseInt(req.params.raceId, 10);

  const race = db.prepare('SELECT * FROM f1_races WHERE id = ?').get(raceId) as any;
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  // Sum scores only up to this race (by round)
  const standings = db.prepare(`
    SELECT u.id, u.username, u.display_name,
           COALESCE(SUM(rs.total_points), 0) as total_points,
           COALESCE(SUM(rs.team_points), 0) as total_team_points,
           COALESCE(SUM(rs.picks_points), 0) as total_picks_points,
           COALESCE(SUM(rs.manual_adjustment), 0) as total_adjustments
    FROM users u
    LEFT JOIN race_scores rs ON rs.user_id = u.id
    LEFT JOIN f1_races fr ON fr.id = rs.race_id
    WHERE fr.round <= ? OR fr.id IS NULL
    GROUP BY u.id
    ORDER BY total_points DESC
  `).all(race.round);

  const result = (standings as any[]).map((s, index) => ({
    ...s,
    rank: index + 1,
  }));

  res.json({ standings: result, asOfRace: race });
});

// GET /settings — league settings
router.get('/settings', (_req: Request, res: Response): void => {
  const settings = db.prepare('SELECT * FROM league_settings').all() as { key: string; value: string }[];

  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  res.json({ settings: settingsMap });
});

export default router;
