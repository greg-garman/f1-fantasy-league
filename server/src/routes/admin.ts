import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db/connection.js';
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
router.post('/score-race/:raceId', (req: Request, res: Response): void => {
  const raceId = parseInt(req.params.raceId, 10);

  if (isNaN(raceId) || raceId < 1) {
    res.status(400).json({ error: 'Invalid race ID' });
    return;
  }

  const race = db.prepare('SELECT * FROM f1_races WHERE id = ?').get(raceId);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  try {
    scoreRace(raceId);
    updatePrices(raceId);
    res.json({ ok: true, message: `Race ${raceId} scored and prices updated` });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to score race' });
  }
});

// PUT /scores/:raceId/:userId — manual score adjustment
router.put('/scores/:raceId/:userId', (req: Request, res: Response): void => {
  const raceId = parseInt(req.params.raceId, 10);
  const userId = parseInt(req.params.userId, 10);
  const { adjustment, reason } = req.body;

  if (typeof adjustment !== 'number') {
    res.status(400).json({ error: 'Adjustment must be a number' });
    return;
  }

  const existing = db.prepare('SELECT * FROM race_scores WHERE user_id = ? AND race_id = ?').get(userId, raceId) as any;

  if (existing) {
    db.prepare(`
      UPDATE race_scores
      SET manual_adjustment = ?, total_points = team_points + picks_points + ?,
          breakdown_json = json_set(COALESCE(breakdown_json, '{}'), '$.manual_adjustment', ?, '$.adjustment_reason', ?)
      WHERE user_id = ? AND race_id = ?
    `).run(adjustment, adjustment, adjustment, reason ?? '', userId, raceId);
  } else {
    db.prepare(`
      INSERT INTO race_scores (user_id, race_id, team_points, picks_points, total_points, manual_adjustment, breakdown_json)
      VALUES (?, ?, 0, 0, ?, ?, ?)
    `).run(userId, raceId, adjustment, adjustment, JSON.stringify({ manual_adjustment: adjustment, adjustment_reason: reason ?? '' }));
  }

  res.json({ ok: true, message: `Score adjustment of ${adjustment} applied for user ${userId} on race ${raceId}` });
});

// POST /matchups/:raceId — set H2H matchups
router.post('/matchups/:raceId', (req: Request, res: Response): void => {
  const raceId = parseInt(req.params.raceId, 10);
  const { matchups } = req.body as { matchups: { driverA: string; driverB: string }[] };

  if (!matchups || !Array.isArray(matchups)) {
    res.status(400).json({ error: 'Matchups array required' });
    return;
  }

  const race = db.prepare('SELECT * FROM f1_races WHERE id = ?').get(raceId);
  if (!race) {
    res.status(404).json({ error: 'Race not found' });
    return;
  }

  const insertMatchup = db.prepare(
    'INSERT INTO h2h_matchups (race_id, driver_a_id, driver_b_id) VALUES (?, ?, ?)'
  );

  const setMatchups = db.transaction(() => {
    // Remove existing matchups for this race
    db.prepare('DELETE FROM h2h_matchups WHERE race_id = ?').run(raceId);

    for (const m of matchups) {
      if (!m.driverA || !m.driverB) {
        throw new Error('Each matchup requires driverA and driverB');
      }
      insertMatchup.run(raceId, m.driverA, m.driverB);
    }
  });

  try {
    setMatchups();
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? 'Failed to set matchups' });
    return;
  }

  const saved = db.prepare('SELECT * FROM h2h_matchups WHERE race_id = ?').all(raceId);
  res.json({ ok: true, matchups: saved });
});

// PUT /league-settings — update a setting
router.put('/league-settings', (req: Request, res: Response): void => {
  const { key, value } = req.body;

  if (!key || value === undefined || value === null) {
    res.status(400).json({ error: 'Key and value required' });
    return;
  }

  db.prepare(`
    INSERT INTO league_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));

  res.json({ ok: true, key, value: String(value) });
});

// POST /invite — generate new invite code
router.post('/invite', (_req: Request, res: Response): void => {
  const code = crypto.randomBytes(4).toString('hex'); // 8-char hex string

  db.prepare("UPDATE league_settings SET value = ? WHERE key = 'invite_code'").run(code);

  res.json({ ok: true, inviteCode: code });
});

export default router;
