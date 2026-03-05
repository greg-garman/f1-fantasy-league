import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/connection.js';
import { config } from '../config.js';

const router = Router();

// GET /standings — overall standings
router.get('/standings', async (_req: Request, res: Response): Promise<void> => {
  // Get all users with total scores
  const standings = await query<any>(`
    SELECT u.id, u.username, u.display_name, u.budget,
           COALESCE(SUM(rs.total_points), 0) as total_points,
           COALESCE(SUM(rs.team_points), 0) as total_team_points,
           COALESCE(SUM(rs.picks_points), 0) as total_picks_points,
           COALESCE(SUM(rs.manual_adjustment), 0) as total_adjustments
    FROM users u
    LEFT JOIN race_scores rs ON rs.user_id = u.id
    GROUP BY u.id
    ORDER BY total_points DESC
  `);

  // Get race-by-race breakdown for each user
  const raceBreakdowns = await query<any>(`
    SELECT rs.user_id, rs.race_id, rs.team_points, rs.picks_points, rs.total_points,
           rs.manual_adjustment, fr.round, fr.race_name
    FROM race_scores rs
    JOIN f1_races fr ON fr.id = rs.race_id
    ORDER BY fr.round ASC
  `);

  const breakdownByUser = new Map<number, any[]>();
  for (const row of raceBreakdowns) {
    const list = breakdownByUser.get(row.user_id) ?? [];
    list.push(row);
    breakdownByUser.set(row.user_id, list);
  }

  const result = standings.map((s: any, index: number) => ({
    ...s,
    rank: index + 1,
    races: breakdownByUser.get(s.id) ?? [],
  }));

  res.json({ standings: result });
});

// GET /standings/:raceId — standings as of a specific race
router.get('/standings/:raceId', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);

  const race = await queryOne<any>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  // Sum scores only up to this race (by round)
  const standings = await query<any>(`
    SELECT u.id, u.username, u.display_name,
           COALESCE(SUM(rs.total_points), 0) as total_points,
           COALESCE(SUM(rs.team_points), 0) as total_team_points,
           COALESCE(SUM(rs.picks_points), 0) as total_picks_points,
           COALESCE(SUM(rs.manual_adjustment), 0) as total_adjustments
    FROM users u
    LEFT JOIN race_scores rs ON rs.user_id = u.id
    LEFT JOIN f1_races fr ON fr.id = rs.race_id
    WHERE fr.round <= $1 OR fr.id IS NULL
    GROUP BY u.id
    ORDER BY total_points DESC
  `, [race.round]);

  const result = standings.map((s: any, index: number) => ({
    ...s,
    rank: index + 1,
  }));

  res.json({ standings: result, asOfRace: race });
});

// GET /settings — league settings
router.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  const settings = await query<{ key: string; value: string }>('SELECT * FROM league_settings');

  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  res.json({ settings: settingsMap });
});

export default router;
