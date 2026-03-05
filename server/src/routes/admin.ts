import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute, executeReturning, transaction } from '../db/connection.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { syncRaceResults, syncSeasonData } from '../services/f1DataSync.js';
import { scoreRace } from '../services/scoring.js';
import { updatePrices } from '../services/priceEngine.js';

const router = Router();

// All admin routes require auth + admin
router.use(authMiddleware);
router.use(adminMiddleware);

// POST /sync-season — trigger full season sync
router.post('/sync-season', async (_req: Request, res: Response): Promise<void> => {
  try {
    await syncSeasonData();
    res.json({ ok: true, message: 'Season data synced successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to sync season data' });
  }
});

// POST /sync-race/:round — trigger syncRaceResults for a round
router.post('/sync-race/:round', async (req: Request, res: Response): Promise<void> => {
  const round = parseInt(req.params.round, 10);

  if (isNaN(round) || round < 1) {
    res.status(400).json({ error: 'Invalid round number' });
    return;
  }

  try {
    await syncRaceResults(round);
    res.json({ ok: true, message: `Race results synced for round ${round}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to sync race results' });
  }
});

// POST /score-race/:raceId — trigger scoreRace and update prices
router.post('/score-race/:raceId', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);

  if (isNaN(raceId) || raceId < 1) {
    res.status(400).json({ error: 'Invalid race ID' });
    return;
  }

  const race = await queryOne<any>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  try {
    await scoreRace(raceId);
    await updatePrices(raceId);
    res.json({ ok: true, message: `Race ${raceId} scored and prices updated` });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to score race' });
  }
});

// PUT /scores/:raceId/:userId — manual score adjustment
router.put('/scores/:raceId/:userId', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);
  const userId = parseInt(req.params.userId, 10);
  const { adjustment, reason } = req.body;

  if (typeof adjustment !== 'number') {
    res.status(400).json({ error: 'Adjustment must be a number' });
    return;
  }

  const existing = await queryOne<any>('SELECT * FROM race_scores WHERE user_id = $1 AND race_id = $2', [userId, raceId]);

  if (existing) {
    // Build the breakdown JSON in JS instead of using json_set
    let breakdown: Record<string, any> = {};
    try {
      breakdown = existing.breakdown_json ? JSON.parse(existing.breakdown_json) : {};
    } catch { /* start fresh */ }
    breakdown.manual_adjustment = adjustment;
    breakdown.adjustment_reason = reason ?? '';

    await execute(`
      UPDATE race_scores
      SET manual_adjustment = $1, total_points = team_points + picks_points + $2,
          breakdown_json = $3
      WHERE user_id = $4 AND race_id = $5
    `, [adjustment, adjustment, JSON.stringify(breakdown), userId, raceId]);
  } else {
    await execute(`
      INSERT INTO race_scores (user_id, race_id, team_points, picks_points, total_points, manual_adjustment, breakdown_json)
      VALUES ($1, $2, 0, 0, $3, $4, $5)
    `, [userId, raceId, adjustment, adjustment, JSON.stringify({ manual_adjustment: adjustment, adjustment_reason: reason ?? '' })]);
  }

  res.json({ ok: true, message: `Score adjustment of ${adjustment} applied for user ${userId} on race ${raceId}` });
});

// POST /matchups/:raceId — set H2H matchups
router.post('/matchups/:raceId', async (req: Request, res: Response): Promise<void> => {
  const raceId = parseInt(req.params.raceId, 10);
  const { matchups } = req.body as { matchups: { driverA: string; driverB: string }[] };

  if (!matchups || !Array.isArray(matchups)) {
    res.status(400).json({ error: 'Matchups array required' });
    return;
  }

  const race = await queryOne<any>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  try {
    await transaction(async (client) => {
      // Remove existing matchups for this race
      await client.query('DELETE FROM h2h_matchups WHERE race_id = $1', [raceId]);

      for (const m of matchups) {
        if (!m.driverA || !m.driverB) {
          throw new Error('Each matchup requires driverA and driverB');
        }
        await client.query(
          'INSERT INTO h2h_matchups (race_id, driver_a_id, driver_b_id) VALUES ($1, $2, $3)',
          [raceId, m.driverA, m.driverB]
        );
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Failed to set matchups' });
    return;
  }

  const saved = await query<any>('SELECT * FROM h2h_matchups WHERE race_id = $1', [raceId]);
  res.json({ ok: true, matchups: saved });
});

// PUT /league-settings — update a setting
router.put('/league-settings', async (req: Request, res: Response): Promise<void> => {
  const { key, value } = req.body;

  if (!key || value === undefined || value === null) {
    res.status(400).json({ error: 'Key and value required' });
    return;
  }

  await execute(`
    INSERT INTO league_settings (key, value) VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, [key, String(value)]);

  res.json({ ok: true, key, value: String(value) });
});

// POST /invite — generate new invite code
router.post('/invite', async (_req: Request, res: Response): Promise<void> => {
  const code = crypto.randomBytes(4).toString('hex'); // 8-char hex string

  await execute("UPDATE league_settings SET value = $1 WHERE key = 'invite_code'", [code]);

  res.json({ ok: true, inviteCode: code });
});

export default router;
