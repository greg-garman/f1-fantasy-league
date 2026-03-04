import { Router, Request, Response } from 'express';
import db from '../db/connection.js';
import type { F1Driver, DriverPriceHistory } from '../types/index.js';

const router = Router();

// GET / — all active drivers with prices, sorted by price desc
router.get('/', (_req: Request, res: Response): void => {
  const drivers = db.prepare(`
    SELECT * FROM f1_drivers
    WHERE is_active = 1
    ORDER BY current_price DESC
  `).all() as F1Driver[];

  res.json({ drivers });
});

// GET /:driverId — single driver with price history
router.get('/:driverId', (req: Request, res: Response): void => {
  const { driverId } = req.params;

  const driver = db.prepare('SELECT * FROM f1_drivers WHERE driver_id = ?').get(driverId) as F1Driver | undefined;

  if (!driver) {
    res.status(404).json({ error: 'Driver not found' });
    return;
  }

  const priceHistory = db.prepare(`
    SELECT dph.*, fr.round, fr.race_name
    FROM driver_price_history dph
    JOIN f1_races fr ON fr.id = dph.race_id
    WHERE dph.driver_id = ?
    ORDER BY fr.round ASC
  `).all(driverId);

  res.json({ driver, priceHistory });
});

export default router;
