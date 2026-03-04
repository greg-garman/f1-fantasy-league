import db from '../db/connection.js';
import { config } from '../config.js';
import type { F1Race } from '../types/index.js';

export function isPicksLocked(raceId: number): boolean {
  const race = db.prepare('SELECT * FROM f1_races WHERE id = ?').get(raceId) as F1Race | undefined;
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

export function getNextRace(): F1Race | null {
  const race = db.prepare(`
    SELECT * FROM f1_races
    WHERE season = ? AND status IN ('upcoming', 'qualifying', 'in_progress')
    ORDER BY round ASC
    LIMIT 1
  `).get(config.seasonYear) as F1Race | undefined;

  return race ?? null;
}

export function lockPicksIfNeeded(): void {
  const upcomingRaces = db.prepare(`
    SELECT * FROM f1_races
    WHERE season = ? AND picks_locked = 0 AND status = 'upcoming'
  `).all(config.seasonYear) as F1Race[];

  const updateLock = db.prepare('UPDATE f1_races SET picks_locked = 1 WHERE id = ?');

  for (const race of upcomingRaces) {
    if (race.quali_date && race.quali_time) {
      const qualiDatetime = new Date(`${race.quali_date}T${race.quali_time}`);
      if (Date.now() >= qualiDatetime.getTime()) {
        updateLock.run(race.id);
        console.log(`Locked picks for race ${race.id} (${race.race_name})`);
      }
    } else if (race.quali_date) {
      const qualiDatetime = new Date(`${race.quali_date}T00:00:00Z`);
      if (Date.now() >= qualiDatetime.getTime()) {
        updateLock.run(race.id);
        console.log(`Locked picks for race ${race.id} (${race.race_name})`);
      }
    }
  }
}
