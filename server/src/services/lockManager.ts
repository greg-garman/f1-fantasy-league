import { query, queryOne, execute } from '../db/connection.js';
import { config } from '../config.js';
import type { F1Race } from '../types/index.js';

export async function isPicksLocked(raceId: number): Promise<boolean> {
  const race = await queryOne<F1Race>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) return true; // If race not found, treat as locked

  if (race.picks_locked === 1) return true;

  // Check if qualifying has started
  if (race.quali_date && race.quali_time) {
    const qualiDatetime = new Date(`${race.quali_date}T${race.quali_time}`);
    if (Date.now() >= qualiDatetime.getTime()) {
      return true;
    }
  } else if (race.quali_date) {
    // If no time specified, lock at start of qualifying day
    const qualiDatetime = new Date(`${race.quali_date}T00:00:00Z`);
    if (Date.now() >= qualiDatetime.getTime()) {
      return true;
    }
  }

  return false;
}

export async function getNextRace(): Promise<F1Race | null> {
  const race = await queryOne<F1Race>(`
    SELECT * FROM f1_races
    WHERE season = $1 AND status IN ('upcoming', 'qualifying', 'in_progress')
    ORDER BY round ASC
    LIMIT 1
  `, [config.seasonYear]);

  return race ?? null;
}

export async function lockPicksIfNeeded(): Promise<void> {
  const upcomingRaces = await query<F1Race>(`
    SELECT * FROM f1_races
    WHERE season = $1 AND picks_locked = 0 AND status = 'upcoming'
  `, [config.seasonYear]);

  for (const race of upcomingRaces) {
    if (race.quali_date && race.quali_time) {
      const qualiDatetime = new Date(`${race.quali_date}T${race.quali_time}`);
      if (Date.now() >= qualiDatetime.getTime()) {
        await execute('UPDATE f1_races SET picks_locked = 1 WHERE id = $1', [race.id]);
        console.log(`Locked picks for race ${race.id} (${race.race_name})`);
      }
    } else if (race.quali_date) {
      const qualiDatetime = new Date(`${race.quali_date}T00:00:00Z`);
      if (Date.now() >= qualiDatetime.getTime()) {
        await execute('UPDATE f1_races SET picks_locked = 1 WHERE id = $1', [race.id]);
        console.log(`Locked picks for race ${race.id} (${race.race_name})`);
      }
    }
  }
}
