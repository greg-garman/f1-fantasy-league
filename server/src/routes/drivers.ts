import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/connection.js';
import type { F1Driver, DriverPriceHistory } from '../types/index.js';

const router = Router();

// GET / — all active drivers with prices, sorted by price desc
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const drivers = await query<F1Driver>(`
    SELECT * FROM f1_drivers
    WHERE is_active = 1
    ORDER BY current_price DESC
  `);

  res.json({ drivers });
});

// GET /:driverId — single driver with price history
router.get('/:driverId', async (req: Request, res: Response): Promise<void> => {
  const { driverId } = req.params;

  const driver = await queryOne<F1Driver>('SELECT * FROM f1_drivers WHERE driver_id = $1', [driverId]);

  if (!driver) {
    res.status(404).json({ error: 'Driver not found' });
    return;
  }

  const priceHistory = await query<DriverPriceHistory & { round: number; race_name: string }>(`
    SELECT dph.*, fr.round, fr.race_name
    FROM driver_price_history dph
    JOIN f1_races fr ON fr.id = dph.race_id
    WHERE dph.driver_id = $1
    ORDER BY fr.round ASC
  `, [driverId]);

  res.json({ driver, priceHistory });
});

export default router;
