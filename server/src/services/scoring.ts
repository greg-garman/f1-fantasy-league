import { query, queryOne, transaction } from '../db/connection.js';
import type { F1RaceResult, UserTeam, WeeklyPick } from '../types/index.js';

// Race finish points
const RACE_POINTS: Record<number, number> = {
  1: 25, 2: 20, 3: 16, 4: 13, 5: 11,
  6: 9, 7: 7, 8: 5, 9: 3, 10: 2,
  11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
};

// Qualifying points
const QUALI_POINTS: Record<number, number> = {
  1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

// Sprint points
const SPRINT_POINTS: Record<number, number> = {
  1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

interface DriverBreakdown {
  driver_id: string;
  race_points: number;
  quali_points: number;
  sprint_points: number;
  fastest_lap_bonus: number;
  positions_gained_bonus: number;
  beat_teammate_bonus: number;
  total: number;
}

interface PickBreakdown {
  pick_type: string;
  pick_value: string;
  is_correct: boolean;
  points: number;
}

function isDNF(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s !== 'finished' && !s.startsWith('+') && s !== '';
}

function isDSQ(status: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase() === 'disqualified';
}

function calcRaceFinishPoints(result: F1RaceResult): number {
  if (isDSQ(result.status)) return -10;
  if (isDNF(result.status)) return -5;
  if (!result.finish_position) return -5; // treat null finish as DNF
  if (result.finish_position >= 16) return 0;
  return RACE_POINTS[result.finish_position] ?? 0;
}

function calcQualiPoints(result: F1RaceResult): number {
  if (!result.finish_position) return 0;
  return QUALI_POINTS[result.finish_position] ?? 0;
}

function calcSprintPoints(result: F1RaceResult): number {
  if (isDNF(result.status) || isDSQ(result.status)) return -3;
  if (!result.finish_position) return -3;
  return SPRINT_POINTS[result.finish_position] ?? 0;
}

function calcPositionsGainedBonus(raceResult: F1RaceResult): number {
  if (!raceResult.grid_position || !raceResult.finish_position) return 0;
  if (isDNF(raceResult.status) || isDSQ(raceResult.status)) return 0;
  const gained = raceResult.grid_position - raceResult.finish_position;
  if (gained >= 10) return 5;
  if (gained >= 5) return 3;
  return 0;
}

export async function scoreRace(raceId: number): Promise<void> {
  console.log(`Scoring race ${raceId}...`);

  // Get all results for this race
  const raceResults = await query<F1RaceResult>(
    'SELECT * FROM f1_race_results WHERE race_id = $1 AND session_type = $2',
    [raceId, 'race']
  );

  const qualiResults = await query<F1RaceResult>(
    'SELECT * FROM f1_race_results WHERE race_id = $1 AND session_type = $2',
    [raceId, 'qualifying']
  );

  const sprintResults = await query<F1RaceResult>(
    'SELECT * FROM f1_race_results WHERE race_id = $1 AND session_type = $2',
    [raceId, 'sprint']
  );

  // Build maps for quick lookup
  const raceByDriver = new Map<string, F1RaceResult>();
  for (const r of raceResults) raceByDriver.set(r.driver_id, r);

  const qualiByDriver = new Map<string, F1RaceResult>();
  for (const q of qualiResults) qualiByDriver.set(q.driver_id, q);

  const sprintByDriver = new Map<string, F1RaceResult>();
  for (const s of sprintResults) sprintByDriver.set(s.driver_id, s);

  // Build teammate map: constructor -> [driver_ids]
  const drivers = await query<{ driver_id: string; constructor_id: string }>(
    'SELECT driver_id, constructor_id FROM f1_drivers WHERE is_active = 1'
  );
  const constructorDrivers = new Map<string, string[]>();
  const driverConstructor = new Map<string, string>();
  for (const d of drivers) {
    driverConstructor.set(d.driver_id, d.constructor_id);
    const list = constructorDrivers.get(d.constructor_id) ?? [];
    list.push(d.driver_id);
    constructorDrivers.set(d.constructor_id, list);
  }

  function getTeammate(driverId: string): string | null {
    const cid = driverConstructor.get(driverId);
    if (!cid) return null;
    const teammates = constructorDrivers.get(cid) ?? [];
    return teammates.find(id => id !== driverId) ?? null;
  }

  function beatTeammate(driverId: string): boolean {
    const teammate = getTeammate(driverId);
    if (!teammate) return false;
    const driverResult = raceByDriver.get(driverId);
    const teammateResult = raceByDriver.get(teammate);
    if (!driverResult || !teammateResult) return false;
    // DNF vs DNF: no bonus
    if (isDNF(driverResult.status) && isDNF(teammateResult.status)) return false;
    // Driver finished, teammate DNF: bonus
    if (!isDNF(driverResult.status) && isDNF(teammateResult.status)) return true;
    // Driver DNF: no bonus
    if (isDNF(driverResult.status)) return false;
    // Both finished: compare positions
    if (driverResult.finish_position && teammateResult.finish_position) {
      return driverResult.finish_position < teammateResult.finish_position;
    }
    return false;
  }

  // Get all users
  const users = await query<{ id: number }>('SELECT id FROM users');

  // H2H matchups for this race
  const matchups = await query<{ id: number; race_id: number; driver_a_id: string; driver_b_id: string }>(
    'SELECT * FROM h2h_matchups WHERE race_id = $1', [raceId]
  );

  // Determine actual race results for pick scoring
  const pole = qualiResults.find(q => q.finish_position === 1)?.driver_id ?? null;
  const winner = raceResults.find(r => r.finish_position === 1)?.driver_id ?? null;
  const fastestLapDriver = raceResults.find(r => r.fastest_lap === 1)?.driver_id ?? null;
  const podiumDrivers = raceResults
    .filter(r => r.finish_position && r.finish_position <= 3)
    .map(r => r.driver_id);
  const dnfDrivers = raceResults
    .filter(r => isDNF(r.status))
    .map(r => r.driver_id);

  // Constructor podium: get constructor of race winner (P1)
  const winnerConstructor = winner ? driverConstructor.get(winner) ?? null : null;

  // H2H actual results: who finished ahead
  const matchupResults = new Map<number, string>(); // matchup id -> winning driver_id
  for (const m of matchups) {
    const aResult = raceByDriver.get(m.driver_a_id);
    const bResult = raceByDriver.get(m.driver_b_id);
    if (!aResult && !bResult) continue;
    if (!aResult) { matchupResults.set(m.id, m.driver_b_id); continue; }
    if (!bResult) { matchupResults.set(m.id, m.driver_a_id); continue; }
    // Both DNF: no winner
    if (isDNF(aResult.status) && isDNF(bResult.status)) continue;
    if (isDNF(aResult.status)) { matchupResults.set(m.id, m.driver_b_id); continue; }
    if (isDNF(bResult.status)) { matchupResults.set(m.id, m.driver_a_id); continue; }
    if (aResult.finish_position && bResult.finish_position) {
      matchupResults.set(m.id, aResult.finish_position < bResult.finish_position ? m.driver_a_id : m.driver_b_id);
    }
  }

  await transaction(async (client) => {
    for (const user of users) {
      // Component A: Team Points
      const teamResult = await client.query('SELECT * FROM user_teams WHERE user_id = $1', [user.id]);
      const team = teamResult.rows as UserTeam[];
      const driverBreakdowns: DriverBreakdown[] = [];

      let teamPoints = 0;

      for (const slot of team) {
        const driverId = slot.driver_id;
        const raceResult = raceByDriver.get(driverId);
        const qualiResult = qualiByDriver.get(driverId);
        const sprintResult = sprintByDriver.get(driverId);

        let raceFinishPts = 0;
        let qualiPts = 0;
        let sprintPts = 0;
        let fastestLapBonus = 0;
        let posGainedBonus = 0;
        let beatTeammateBonus = 0;

        if (raceResult) {
          raceFinishPts = calcRaceFinishPoints(raceResult);
          posGainedBonus = calcPositionsGainedBonus(raceResult);
          if (raceResult.fastest_lap === 1) fastestLapBonus = 5;
          if (beatTeammate(driverId)) beatTeammateBonus = 2;
        }

        if (qualiResult) {
          qualiPts = calcQualiPoints(qualiResult);
        }

        if (sprintResult) {
          sprintPts = calcSprintPoints(sprintResult);
        }

        const driverTotal = raceFinishPts + qualiPts + sprintPts + fastestLapBonus + posGainedBonus + beatTeammateBonus;
        teamPoints += driverTotal;

        driverBreakdowns.push({
          driver_id: driverId,
          race_points: raceFinishPts,
          quali_points: qualiPts,
          sprint_points: sprintPts,
          fastest_lap_bonus: fastestLapBonus,
          positions_gained_bonus: posGainedBonus,
          beat_teammate_bonus: beatTeammateBonus,
          total: driverTotal,
        });
      }

      // Component B: Weekly Picks Points
      const picksResult = await client.query('SELECT * FROM weekly_picks WHERE user_id = $1 AND race_id = $2', [user.id, raceId]);
      const picks = picksResult.rows as WeeklyPick[];
      let picksPoints = 0;
      const pickBreakdowns: PickBreakdown[] = [];

      for (const pick of picks) {
        let correct = false;
        let pts = 0;

        switch (pick.pick_type) {
          case 'pole':
            correct = pick.pick_value === pole;
            pts = correct ? 10 : 0;
            break;

          case 'winner':
            correct = pick.pick_value === winner;
            pts = correct ? 10 : 0;
            break;

          case 'fastest_lap':
            correct = pick.pick_value === fastestLapDriver;
            pts = correct ? 8 : 0;
            break;

          case 'podium': {
            // pick_value is a JSON array of 3 driver IDs
            try {
              const pickedPodium: string[] = JSON.parse(pick.pick_value);
              let podiumCorrect = 0;
              for (const p of pickedPodium) {
                if (podiumDrivers.includes(p)) podiumCorrect++;
              }
              correct = podiumCorrect > 0;
              pts = podiumCorrect * 5; // max 15
            } catch {
              pts = 0;
            }
            break;
          }

          case 'dnf':
            correct = dnfDrivers.includes(pick.pick_value);
            pts = correct ? 8 : 0;
            break;

          case 'h2h': {
            // pick_value is a JSON object: { "matchupId": "driverId", ... }
            try {
              const h2hPicks: Record<string, string> = JSON.parse(pick.pick_value);
              let h2hCorrect = 0;
              for (const [matchupId, pickedDriverId] of Object.entries(h2hPicks)) {
                const actualWinner = matchupResults.get(parseInt(matchupId, 10));
                if (actualWinner && actualWinner === pickedDriverId) h2hCorrect++;
              }
              correct = h2hCorrect > 0;
              pts = h2hCorrect * 5; // max 15
            } catch {
              pts = 0;
            }
            break;
          }

          case 'constructor_podium':
            correct = pick.pick_value === winnerConstructor;
            pts = correct ? 6 : 0;
            break;

          default:
            break;
        }

        picksPoints += pts;
        pickBreakdowns.push({
          pick_type: pick.pick_type,
          pick_value: pick.pick_value,
          is_correct: correct,
          points: pts,
        });

        await client.query(
          'UPDATE weekly_picks SET is_correct = $1, points_earned = $2 WHERE id = $3',
          [correct ? 1 : 0, pts, pick.id]
        );
      }

      // Get existing manual adjustment if any
      const existingResult = await client.query(
        'SELECT manual_adjustment FROM race_scores WHERE user_id = $1 AND race_id = $2',
        [user.id, raceId]
      );
      const existing = existingResult.rows[0] as { manual_adjustment: number } | undefined;
      const manualAdj = existing?.manual_adjustment ?? 0;

      const totalPoints = teamPoints + picksPoints + manualAdj;

      const breakdown = JSON.stringify({
        drivers: driverBreakdowns,
        picks: pickBreakdowns,
        team_points: teamPoints,
        picks_points: picksPoints,
        manual_adjustment: manualAdj,
      });

      await client.query(`
        INSERT INTO race_scores (user_id, race_id, team_points, picks_points, total_points, breakdown_json)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(user_id, race_id) DO UPDATE SET
          team_points = excluded.team_points,
          picks_points = excluded.picks_points,
          total_points = excluded.total_points,
          breakdown_json = excluded.breakdown_json
      `, [user.id, raceId, teamPoints, picksPoints, totalPoints, breakdown]);
    }
  });

  console.log(`Scored race ${raceId} for ${users.length} users.`);
}
