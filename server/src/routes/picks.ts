import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { isPicksLocked } from '../services/lockManager.js';
import type { WeeklyPick, F1Race } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

const VALID_PICK_TYPES = ['pole', 'winner', 'fastest_lap', 'podium', 'dnf', 'h2h', 'constructor_podium'];

// POST /:raceId — submit picks
router.post('/:raceId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const raceId = parseInt(req.params.raceId, 10);

  const race = await queryOne<F1Race>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  // Check lock
  if (await isPicksLocked(raceId)) {
    res.status(400).json({ error: 'Picks are locked for this race (qualifying has started)' });
    return;
  }

  const { pole, winner, fastestLap, podium, dnf, h2h, constructorPodium } = req.body;

  const upsertSql = `
    INSERT INTO weekly_picks (user_id, race_id, pick_type, pick_value)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(user_id, race_id, pick_type) DO UPDATE SET
      pick_value = excluded.pick_value,
      is_correct = NULL,
      points_earned = 0
  `;

  try {
    await transaction(async (client) => {
      if (pole) {
        await client.query(upsertSql, [userId, raceId, 'pole', pole]);
      }
      if (winner) {
        await client.query(upsertSql, [userId, raceId, 'winner', winner]);
      }
      if (fastestLap) {
        await client.query(upsertSql, [userId, raceId, 'fastest_lap', fastestLap]);
      }
      if (podium && Array.isArray(podium)) {
        if (podium.length > 3) {
          throw new Error('Maximum 3 podium picks allowed');
        }
        await client.query(upsertSql, [userId, raceId, 'podium', JSON.stringify(podium)]);
      }
      if (dnf) {
        await client.query(upsertSql, [userId, raceId, 'dnf', dnf]);
      }
      if (h2h && typeof h2h === 'object') {
        await client.query(upsertSql, [userId, raceId, 'h2h', JSON.stringify(h2h)]);
      }
      if (constructorPodium && Array.isArray(constructorPodium)) {
        if (constructorPodium.length > 3) {
          throw new Error('Maximum 3 constructor podium picks allowed');
        }
        await client.query(upsertSql, [userId, raceId, 'constructor_podium', JSON.stringify(constructorPodium)]);
      } else if (constructorPodium) {
        await client.query(upsertSql, [userId, raceId, 'constructor_podium', constructorPodium]);
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Failed to save picks' });
    return;
  }

  // Return saved picks
  const picks = await query<WeeklyPick>('SELECT * FROM weekly_picks WHERE user_id = $1 AND race_id = $2', [userId, raceId]);

  res.json({ picks });
});

// GET /:raceId — my picks for a race
router.get('/:raceId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const raceId = parseInt(req.params.raceId, 10);

  const picks = await query<WeeklyPick>('SELECT * FROM weekly_picks WHERE user_id = $1 AND race_id = $2', [userId, raceId]);

  // Transform picks into a more usable format
  const picksMap: Record<string, any> = {};
  for (const pick of picks) {
    let value: any = pick.pick_value;
    if (pick.pick_type === 'podium' || pick.pick_type === 'h2h') {
      try { value = JSON.parse(pick.pick_value); } catch { /* keep as string */ }
    }
    picksMap[pick.pick_type] = {
      value,
      is_correct: pick.is_correct,
      points_earned: pick.points_earned,
    };
  }

  res.json({ picks: picksMap, raw: picks });
});

// GET /:raceId/all — all players' picks (only if race completed)
router.get('/:raceId/all', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);

  const race = await queryOne<F1Race>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  if (race.status !== 'completed') {
    res.status(403).json({ error: 'Picks are only visible after the race is completed' });
    return;
  }

  const allPicks = await query<any>(`
    SELECT wp.*, u.display_name, u.username
    FROM weekly_picks wp
    JOIN users u ON u.id = wp.user_id
    WHERE wp.race_id = $1
    ORDER BY u.display_name, wp.pick_type
  `, [raceId]);

  // Group by user
  const grouped: Record<number, { user: { display_name: string; username: string }; picks: any[] }> = {};
  for (const pick of allPicks) {
    if (!grouped[pick.user_id]) {
      grouped[pick.user_id] = {
        user: { display_name: pick.display_name, username: pick.username },
        picks: [],
      };
    }
    grouped[pick.user_id].picks.push(pick);
  }

  res.json({ picks: grouped });
});

// GET /:raceId/matchups — get H2H matchups for the race
router.get('/:raceId/matchups', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);

  const matchups = await query<any>(`
    SELECT m.*,
           da.code as driver_a_code, da.first_name as driver_a_first, da.last_name as driver_a_last, da.constructor_name as driver_a_constructor,
           dbb.code as driver_b_code, dbb.first_name as driver_b_first, dbb.last_name as driver_b_last, dbb.constructor_name as driver_b_constructor
    FROM h2h_matchups m
    LEFT JOIN f1_drivers da ON da.driver_id = m.driver_a_id
    LEFT JOIN f1_drivers dbb ON dbb.driver_id = m.driver_b_id
    WHERE m.race_id = $1
  `, [raceId]);

  res.json({ matchups });
});

export default router;
