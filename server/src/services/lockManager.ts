import { query, queryOne, execute } from '../db/connection.js';
import { config } from '../config.js';
import type { F1Race } from '../types/index.js';

/**
 * Build a proper UTC Date from a date string and optional time string.
 * Handles cases where the time may or may not include a 'Z' suffix.
 */
function parseRaceDateTime(dateStr: string, timeStr?: string | null): Date {
  if (timeStr) {
    // Ensure the time string ends with 'Z' for UTC
    const utcTime = timeStr.endsWith('Z') ? timeStr : timeStr + 'Z';
    return new Date(`${dateStr}T${utcTime}`);
  }
  return new Date(`${dateStr}T00:00:00Z`);
}

export async function isPicksLocked(raceId: number): Promise<boolean> {
  const race = await queryOne<F1Race>('SELECT * FROM f1_races WHERE id = $1', [raceId]);
  if (!race) return true; // If race not found, treat as locked

  // If picks_locked is explicitly 1, it's locked
  if (race.picks_locked === 1) return true;

  // If picks_locked is 0 and status is 'upcoming', trust the DB value
  // (admin may have manually unlocked it)
  if (race.picks_locked === 0 && race.status === 'upcoming') return false;

  // Check if qualifying has started (using UTC-safe parsing)
  if (race.quali_date) {
    const qualiDatetime = parseRaceDateTime(race.quali_date, race.quali_time);
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
    if (race.quali_date) {
      const qualiDatetime = parseRaceDateTime(race.quali_date, race.quali_time);
      if (Date.now() >= qualiDatetime.getTime()) {
        await execute('UPDATE f1_races SET picks_locked = 1 WHERE id = $1', [race.id]);
        console.log(`Locked picks for race ${race.id} (${race.race_name})`);
      }
    }
  }
}
