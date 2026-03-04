import db from '../db/connection.js';
import type { F1Driver } from '../types/index.js';

export function updatePrices(raceId: number): void {
  console.log(`Updating driver prices after race ${raceId}...`);

  const race = db.prepare('SELECT * FROM f1_races WHERE id = ?').get(raceId) as { id: number; round: number; season: number } | undefined;
  if (!race) {
    throw new Error(`Race ${raceId} not found`);
  }

  const activeDrivers = db.prepare('SELECT * FROM f1_drivers WHERE is_active = 1').all() as F1Driver[];

  // Get the last 3 completed races up to and including this one for rolling average
  const recentRaces = db.prepare(`
    SELECT id FROM f1_races
    WHERE season = ? AND status = 'completed' AND round <= ?
    ORDER BY round DESC
    LIMIT 3
  `).all(race.season, race.round) as { id: number }[];

  const recentRaceIds = recentRaces.map(r => r.id);

  const upsertPriceHistory = db.prepare(`
    INSERT INTO driver_price_history (driver_id, race_id, price)
    VALUES (?, ?, ?)
  `);

  const updateDriverPrice = db.prepare(`
    UPDATE f1_drivers SET current_price = ? WHERE driver_id = ?
  `);

  // Calculate fantasy points per driver for this race from race_scores breakdown
  // We need per-driver points. Get from f1_race_results and compute similarly to scoring.
  // Simpler approach: sum up the points from all sessions for the driver this race.
  function getDriverFantasyPoints(driverId: string, targetRaceId: number): number {
    const results = db.prepare(
      'SELECT * FROM f1_race_results WHERE race_id = ? AND driver_id = ?'
    ).all(targetRaceId, driverId) as { session_type: string; finish_position: number | null; status: string | null; fastest_lap: number; grid_position: number | null }[];

    let points = 0;
    for (const r of results) {
      if (r.session_type === 'race') {
        if (r.status?.toLowerCase() === 'disqualified') { points -= 10; continue; }
        if (r.status && r.status.toLowerCase() !== 'finished' && !r.status.startsWith('+')) { points -= 5; continue; }
        if (r.finish_position) {
          const raceMap: Record<number, number> = { 1: 25, 2: 20, 3: 16, 4: 13, 5: 11, 6: 9, 7: 7, 8: 5, 9: 3, 10: 2, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1 };
          points += raceMap[r.finish_position] ?? 0;
        }
        if (r.fastest_lap) points += 5;
        if (r.grid_position && r.finish_position) {
          const gained = r.grid_position - r.finish_position;
          if (gained >= 10) points += 5;
          else if (gained >= 5) points += 3;
        }
      } else if (r.session_type === 'qualifying') {
        if (r.finish_position) {
          const qualiMap: Record<number, number> = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
          points += qualiMap[r.finish_position] ?? 0;
        }
      } else if (r.session_type === 'sprint') {
        if (r.status && r.status.toLowerCase() !== 'finished' && !r.status.startsWith('+')) { points -= 3; continue; }
        if (r.finish_position) {
          const sprintMap: Record<number, number> = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
          points += sprintMap[r.finish_position] ?? 0;
        }
      }
    }
    return points;
  }

  const updateAll = db.transaction(() => {
    for (const driver of activeDrivers) {
      const currentRacePoints = getDriverFantasyPoints(driver.driver_id, raceId);

      // Rolling 3-race average (including current race)
      let totalRecentPoints = 0;
      for (const rid of recentRaceIds) {
        totalRecentPoints += getDriverFantasyPoints(driver.driver_id, rid);
      }
      const rollingAvg = recentRaceIds.length > 0 ? totalRecentPoints / recentRaceIds.length : 0;

      // Price adjustment
      const adjustment = (currentRacePoints - rollingAvg) * 0.1;
      let newPrice = driver.current_price + adjustment;

      // Clamp to +/- 40% of initial price
      const minPrice = driver.initial_price * 0.6;
      const maxPrice = driver.initial_price * 1.4;
      newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

      // Round to nearest 0.1
      newPrice = Math.round(newPrice * 10) / 10;

      updateDriverPrice.run(newPrice, driver.driver_id);
      upsertPriceHistory.run(driver.driver_id, raceId, newPrice);
    }
  });

  updateAll();
  console.log(`Updated prices for ${activeDrivers.length} drivers.`);
}
