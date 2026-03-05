import cron from 'node-cron';
import { syncSeasonData, syncRaceResults } from '../services/f1DataSync.js';
import { lockPicksIfNeeded, getNextRace } from '../services/lockManager.js';

export function initScheduler(): void {
  console.log('Initializing job scheduler...');

  // Daily at 06:00 UTC: sync season data (calendar + drivers)
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running daily season sync...');
    try {
      await syncSeasonData();
      console.log('[Scheduler] Season sync completed.');
    } catch (err) {
      console.error('[Scheduler] Season sync failed:', err);
    }
  }, { timezone: 'UTC' });

  // Saturdays 12:00-20:00 UTC every 30 min: sync qualifying for current round
  cron.schedule('*/30 12-20 * * 6', async () => {
    console.log('[Scheduler] Checking for qualifying results...');
    try {
      const nextRace = await getNextRace();
      if (nextRace) {
        await syncRaceResults(nextRace.round);
        console.log(`[Scheduler] Qualifying sync for round ${nextRace.round} completed.`);
      }
    } catch (err) {
      console.error('[Scheduler] Qualifying sync failed:', err);
    }
  }, { timezone: 'UTC' });

  // Sundays 12:00-22:00 UTC every 15 min: sync race results for current round
  cron.schedule('*/15 12-22 * * 0', async () => {
    console.log('[Scheduler] Checking for race results...');
    try {
      const nextRace = await getNextRace();
      if (nextRace) {
        await syncRaceResults(nextRace.round);
        console.log(`[Scheduler] Race sync for round ${nextRace.round} completed.`);
      }
    } catch (err) {
      console.error('[Scheduler] Race sync failed:', err);
    }
  }, { timezone: 'UTC' });

  // Every hour: lock picks if qualifying has started
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Checking pick locks...');
    try {
      await lockPicksIfNeeded();
      console.log('[Scheduler] Pick lock check completed.');
    } catch (err) {
      console.error('[Scheduler] Pick lock check failed:', err);
    }
  }, { timezone: 'UTC' });

  console.log('Job scheduler initialized with 4 cron jobs.');
}
