import { Router, Request, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/connection.js';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { isPicksLocked, getNextRace } from '../services/lockManager.js';
import type { F1Driver, UserTeam, Transfer } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /my — current user's team
router.get('/my', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const team = await query<any>(`
    SELECT ut.*, d.code, d.first_name, d.last_name, d.constructor_name,
           d.constructor_id, d.current_price, d.initial_price, d.nationality, d.number, d.photo_url
    FROM user_teams ut
    JOIN f1_drivers d ON d.driver_id = ut.driver_id
    WHERE ut.user_id = $1
    ORDER BY ut.slot ASC
  `, [userId]);

  const user = await queryOne<{ budget: number }>('SELECT budget FROM users WHERE id = $1', [userId]);

  res.json({ team, budget: user!.budget });
});

// PUT /my — make transfers
router.put('/my', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { transfers } = req.body as { transfers: { slot: number; driverInId: string }[] };

  if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
    res.status(400).json({ error: 'Transfers array required' });
    return;
  }

  // Get the next race for lock check and transfer tracking
  const nextRace = await getNextRace();
  if (!nextRace) {
    res.status(400).json({ error: 'No upcoming race found' });
    return;
  }

  // Check if picks are locked
  if (await isPicksLocked(nextRace.id)) {
    res.status(400).json({ error: 'Transfers are locked for this race (qualifying has started)' });
    return;
  }

  // Get current team
  const currentTeam = await query<UserTeam>('SELECT * FROM user_teams WHERE user_id = $1', [userId]);
  const currentDriverIds = currentTeam.map(t => t.driver_id);

  // Get user budget
  const user = await queryOne<{ budget: number }>('SELECT budget FROM users WHERE id = $1', [userId]);
  let budget = user!.budget;

  // Check free transfers remaining
  const transfersThisRace = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM transfers WHERE user_id = $1 AND race_id = $2',
    [userId, nextRace.id]
  );

  const freeTransfersUsed = transfersThisRace!.count;
  const freeRemaining = Math.max(0, config.freeTransfersPerRace - freeTransfersUsed);

  // Validate all transfers before executing
  const transferOps: { slot: number; driverOut: UserTeam | undefined; driverIn: F1Driver }[] = [];

  for (const transfer of transfers) {
    // Validate driver exists and is active
    const driverIn = await queryOne<F1Driver>('SELECT * FROM f1_drivers WHERE driver_id = $1 AND is_active = 1', [transfer.driverInId]);
    if (!driverIn) {
      res.status(400).json({ error: `Driver ${transfer.driverInId} not found or inactive` });
      return;
    }

    // Check if driver is already on team (and not being transferred out in this batch)
    const alreadyOnTeam = currentDriverIds.includes(transfer.driverInId);
    const beingTransferredOut = transfers.some(t => {
      const existing = currentTeam.find(ct => ct.slot === t.slot);
      return existing?.driver_id === transfer.driverInId;
    });
    if (alreadyOnTeam && !beingTransferredOut) {
      res.status(400).json({ error: `Driver ${transfer.driverInId} is already on your team` });
      return;
    }

    // Also check that the incoming driver is not added twice in the same batch
    const duplicateInBatch = transfers.filter(t => t.driverInId === transfer.driverInId).length > 1;
    if (duplicateInBatch) {
      res.status(400).json({ error: `Driver ${transfer.driverInId} appears multiple times in transfers` });
      return;
    }

    const driverOut = currentTeam.find(t => t.slot === transfer.slot);
    transferOps.push({ slot: transfer.slot, driverOut, driverIn });
  }

  // Calculate budget impact
  let budgetChange = 0;
  for (const op of transferOps) {
    if (op.driverOut) {
      // Selling driver: get current price (not what was paid)
      const outDriver = await queryOne<{ current_price: number }>('SELECT current_price FROM f1_drivers WHERE driver_id = $1', [op.driverOut.driver_id]);
      budgetChange += outDriver?.current_price ?? op.driverOut.price_paid;
    }
    budgetChange -= op.driverIn.current_price;
  }

  if (budget + budgetChange < 0) {
    res.status(400).json({ error: 'Insufficient budget for these transfers' });
    return;
  }

  // Calculate penalty points for extra transfers
  const extraTransfers = Math.max(0, transfers.length - freeRemaining);
  const penalty = extraTransfers * config.extraTransferPenalty;

  // Execute transfers
  await transaction(async (client) => {
    for (const op of transferOps) {
      // Remove old driver from slot if exists
      if (op.driverOut) {
        await client.query('DELETE FROM user_teams WHERE user_id = $1 AND slot = $2', [userId, op.slot]);
      }

      // Add new driver
      await client.query(
        'INSERT INTO user_teams (user_id, driver_id, slot, price_paid) VALUES ($1, $2, $3, $4)',
        [userId, op.driverIn.driver_id, op.slot, op.driverIn.current_price]
      );

      // Get current price for driver out
      let priceOut = 0;
      if (op.driverOut) {
        const outResult = await client.query('SELECT current_price FROM f1_drivers WHERE driver_id = $1', [op.driverOut.driver_id]);
        priceOut = outResult.rows[0]?.current_price ?? 0;
      }

      // Record transfer
      await client.query(`
        INSERT INTO transfers (user_id, race_id, driver_out_id, driver_in_id, price_out, price_in)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        nextRace.id,
        op.driverOut?.driver_id ?? '',
        op.driverIn.driver_id,
        priceOut,
        op.driverIn.current_price
      ]);
    }

    // Update user budget
    const newBudget = Math.round((budget + budgetChange) * 10) / 10;
    await client.query('UPDATE users SET budget = $1 WHERE id = $2', [newBudget, userId]);

    // Apply penalty as manual adjustment if needed
    if (penalty > 0) {
      const existingResult = await client.query('SELECT * FROM race_scores WHERE user_id = $1 AND race_id = $2', [userId, nextRace.id]);
      const existing = existingResult.rows[0];
      if (existing) {
        await client.query(`
          UPDATE race_scores SET manual_adjustment = manual_adjustment - $1, total_points = total_points - $2 WHERE user_id = $3 AND race_id = $4
        `, [penalty, penalty, userId, nextRace.id]);
      } else {
        await client.query(`
          INSERT INTO race_scores (user_id, race_id, team_points, picks_points, total_points, manual_adjustment)
          VALUES ($1, $2, 0, 0, $3, $4)
        `, [userId, nextRace.id, -penalty, -penalty]);
      }
    }
  });

  // Return updated team
  const updatedTeam = await query<any>(`
    SELECT ut.*, d.code, d.first_name, d.last_name, d.constructor_name, d.current_price
    FROM user_teams ut
    JOIN f1_drivers d ON d.driver_id = ut.driver_id
    WHERE ut.user_id = $1
    ORDER BY ut.slot ASC
  `, [userId]);

  const updatedUser = await queryOne<{ budget: number }>('SELECT budget FROM users WHERE id = $1', [userId]);

  res.json({
    team: updatedTeam,
    budget: updatedUser!.budget,
    penalty,
    extraTransfers,
  });
});

// GET /transfers/remaining — how many free transfers user has left
router.get('/transfers/remaining', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const nextRace = await getNextRace();
  if (!nextRace) {
    res.json({ remaining: config.freeTransfersPerRace, raceId: null });
    return;
  }

  const transfersThisRace = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM transfers WHERE user_id = $1 AND race_id = $2',
    [userId, nextRace.id]
  );

  const remaining = Math.max(0, config.freeTransfersPerRace - transfersThisRace!.count);

  res.json({
    remaining,
    total: config.freeTransfersPerRace,
    used: transfersThisRace!.count,
    raceId: nextRace.id,
    penaltyPerExtra: config.extraTransferPenalty,
  });
});

// GET /transfers/log — league-wide transfer log
router.get('/transfers/log', async (_req: Request, res: Response): Promise<void> => {
  const transfers = await query<any>(`
    SELECT t.*, u.display_name, u.username,
           din.code as driver_in_code, din.first_name as driver_in_first, din.last_name as driver_in_last,
           dout.code as driver_out_code, dout.first_name as driver_out_first, dout.last_name as driver_out_last,
           fr.race_name, fr.round
    FROM transfers t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN f1_drivers din ON din.driver_id = t.driver_in_id
    LEFT JOIN f1_drivers dout ON dout.driver_id = t.driver_out_id
    LEFT JOIN f1_races fr ON fr.id = t.race_id
    ORDER BY t.created_at DESC
    LIMIT 100
  `);

  res.json({ transfers });
});

// GET /:userId — view another player's team
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);

  const user = await queryOne<{ id: number; username: string; display_name: string; budget: number }>(
    'SELECT id, username, display_name, budget FROM users WHERE id = $1', [userId]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const team = await query<any>(`
    SELECT ut.*, d.code, d.first_name, d.last_name, d.constructor_name,
           d.constructor_id, d.current_price, d.initial_price, d.nationality, d.number
    FROM user_teams ut
    JOIN f1_drivers d ON d.driver_id = ut.driver_id
    WHERE ut.user_id = $1
    ORDER BY ut.slot ASC
  `, [userId]);

  res.json({ user: { id: user.id, username: user.username, display_name: user.display_name }, team });
});

export default router;
