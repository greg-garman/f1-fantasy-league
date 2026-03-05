import { query, queryOne, transaction } from '../db/connection.js';
import type { F1Driver } from '../types/index.js';

export async function updatePrices(raceId: number): Promise<void> {
  console.log(`Updating driver prices after race ${raceId}...`);

  const race = await queryOne<{ id: number; round: number; season: number }>(
    'SELECT * FROM f1_races WHERE id = $1', [raceId]
  );
  if (!race) {
    throw new Error(`Race ${raceId} not found`);
  }

  const activeDrivers = await query<F1Driver>(
    'SELECT * FROM f1_drivers WHERE is_active = 1'
  );

  // Get the last 3 completed races up to and including this one for rolling average
  const recentRaces = await query<{ id: number }>(`
    SELECT id FROM f1_races
    WHERE season = $1 AND status = 'completed' AND round <= $2
    ORDER BY round DESC
    LIMIT 3
  `, [race.season, race.round]);

  const recentRaceIds = recentRaces.map(r => r.id);

  // Calculate fantasy points per driver for this race from race_scores breakdown
  // We need per-driver points. Get from f1_race_results and compute similarly to scoring.
  // Simpler approach: sum up the points from all sessions for the driver this race.
  async function getDriverFantasyPoints(driverId: string, targetRaceId: number): Promise<number> {
    const results = await query<{ session_type: string; finish_position: number | null; status: string | null; fastest_lap: number; grid_position: number | null }>(
      'SELECT * FROM f1_race_results WHERE race_id = $1 AND driver_id = $2',
      [targetRaceId, driverId]
    );

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

  // Pre-fetch all driver fantasy points before the transaction
  const driverPointsMap = new Map<string, { currentRacePoints: number; rollingAvg: number }>();
  for (const driver of activeDrivers) {
    const currentRacePoints = await getDriverFantasyPoints(driver.driver_id, raceId);

    let totalRecentPoints = 0;
    for (const rid of recentRaceIds) {
      totalRecentPoints += await getDriverFantasyPoints(driver.driver_id, rid);
    }
    const rollingAvg = recentRaceIds.length > 0 ? totalRecentPoints / recentRaceIds.length : 0;

    driverPointsMap.set(driver.driver_id, { currentRacePoints, rollingAvg });
  }

  await transaction(async (client) => {
    for (const driver of activeDrivers) {
      const { currentRacePoints, rollingAvg } = driverPointsMap.get(driver.driver_id)!;

      // Price adjustment
      const adjustment = (currentRacePoints - rollingAvg) * 0.1;
      let newPrice = driver.current_price + adjustment;

      // Clamp to +/- 40% of initial price
      const minPrice = driver.initial_price * 0.6;
      const maxPrice = driver.initial_price * 1.4;
      newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

      // Round to nearest 0.1
      newPrice = Math.round(newPrice * 10) / 10;

      await client.query('UPDATE f1_drivers SET current_price = $1 WHERE driver_id = $2', [newPrice, driver.driver_id]);
      await client.query('INSERT INTO driver_price_history (driver_id, race_id, price) VALUES ($1, $2, $3)', [driver.driver_id, raceId, newPrice]);
    }
  });

  console.log(`Updated prices for ${activeDrivers.length} drivers.`);
}
