import { execute, query, queryOne, transaction } from '../db/connection.js';
import { config } from '../config.js';

const API_BASE = config.f1ApiBase;
const SEASON = config.seasonYear;

/**
 * Determine which season to use for driver data.
 * Before round 1 is completed, use driverDataSeason (e.g. 2025).
 * After round 1 is completed, switch to the current seasonYear (e.g. 2026).
 */
async function getDriverSeason(): Promise<number> {
  const round1 = await queryOne<{ status: string }>(
    "SELECT status FROM f1_races WHERE season = $1 AND round = 1",
    [SEASON]
  );
  if (round1 && round1.status === 'completed') {
    return SEASON;
  }
  return config.driverDataSeason;
}

// Constructor tier pricing
const CONSTRUCTOR_TIERS: Record<string, { min: number; max: number }> = {
  // Top teams
  'Red Bull': { min: 25, max: 30 },
  'Ferrari': { min: 25, max: 30 },
  'McLaren': { min: 25, max: 30 },
  'Mercedes': { min: 23, max: 28 },
  // Midfield
  'Aston Martin': { min: 13, max: 17 },
  'Alpine': { min: 10, max: 15 },
  'Williams': { min: 10, max: 14 },
  'RB': { min: 10, max: 15 },
  'Haas F1 Team': { min: 10, max: 14 },
  // Backmarkers
  'Sauber': { min: 3, max: 8 },
  'Kick Sauber': { min: 3, max: 8 },
};

function getDriverPrice(constructorName: string, driverIndex: number): number {
  for (const [key, tier] of Object.entries(CONSTRUCTOR_TIERS)) {
    if (constructorName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(constructorName.toLowerCase())) {
      // First driver in a team gets the higher price
      return driverIndex === 0 ? tier.max : tier.min;
    }
  }
  // Default midfield pricing for unknown constructors
  return driverIndex === 0 ? 12 : 10;
}

// Hardcoded 2026 F1 calendar (used when Ergast has no data for the season)
const FALLBACK_2026_CALENDAR = [
  { round: '1', raceName: 'Australian Grand Prix', date: '2026-03-15', time: '05:00:00Z', Circuit: { circuitName: 'Albert Park Grand Prix Circuit', Location: { country: 'Australia' } }, Qualifying: { date: '2026-03-14', time: '06:00:00Z' }, FirstPractice: { date: '2026-03-13' } },
  { round: '2', raceName: 'Chinese Grand Prix', date: '2026-03-29', time: '07:00:00Z', Circuit: { circuitName: 'Shanghai International Circuit', Location: { country: 'China' } }, Qualifying: { date: '2026-03-28', time: '07:00:00Z' }, Sprint: { date: '2026-03-28' }, FirstPractice: { date: '2026-03-27' } },
  { round: '3', raceName: 'Japanese Grand Prix', date: '2026-04-12', time: '05:00:00Z', Circuit: { circuitName: 'Suzuka Circuit', Location: { country: 'Japan' } }, Qualifying: { date: '2026-04-11', time: '06:00:00Z' }, FirstPractice: { date: '2026-04-10' } },
  { round: '4', raceName: 'Bahrain Grand Prix', date: '2026-04-19', time: '15:00:00Z', Circuit: { circuitName: 'Bahrain International Circuit', Location: { country: 'Bahrain' } }, Qualifying: { date: '2026-04-18', time: '15:00:00Z' }, FirstPractice: { date: '2026-04-17' } },
  { round: '5', raceName: 'Saudi Arabian Grand Prix', date: '2026-04-26', time: '17:00:00Z', Circuit: { circuitName: 'Jeddah Corniche Circuit', Location: { country: 'Saudi Arabia' } }, Qualifying: { date: '2026-04-25', time: '17:00:00Z' }, FirstPractice: { date: '2026-04-24' } },
  { round: '6', raceName: 'Miami Grand Prix', date: '2026-05-10', time: '20:00:00Z', Circuit: { circuitName: 'Miami International Autodrome', Location: { country: 'USA' } }, Qualifying: { date: '2026-05-09', time: '20:00:00Z' }, Sprint: { date: '2026-05-09' }, FirstPractice: { date: '2026-05-08' } },
  { round: '7', raceName: 'Emilia Romagna Grand Prix', date: '2026-05-24', time: '13:00:00Z', Circuit: { circuitName: 'Autodromo Enzo e Dino Ferrari', Location: { country: 'Italy' } }, Qualifying: { date: '2026-05-23', time: '14:00:00Z' }, FirstPractice: { date: '2026-05-22' } },
  { round: '8', raceName: 'Monaco Grand Prix', date: '2026-05-31', time: '13:00:00Z', Circuit: { circuitName: 'Circuit de Monaco', Location: { country: 'Monaco' } }, Qualifying: { date: '2026-05-30', time: '14:00:00Z' }, FirstPractice: { date: '2026-05-29' } },
  { round: '9', raceName: 'Spanish Grand Prix', date: '2026-06-14', time: '13:00:00Z', Circuit: { circuitName: 'Circuit de Barcelona-Catalunya', Location: { country: 'Spain' } }, Qualifying: { date: '2026-06-13', time: '14:00:00Z' }, FirstPractice: { date: '2026-06-12' } },
  { round: '10', raceName: 'Canadian Grand Prix', date: '2026-06-28', time: '18:00:00Z', Circuit: { circuitName: 'Circuit Gilles Villeneuve', Location: { country: 'Canada' } }, Qualifying: { date: '2026-06-27', time: '20:00:00Z' }, FirstPractice: { date: '2026-06-26' } },
  { round: '11', raceName: 'Austrian Grand Prix', date: '2026-07-05', time: '13:00:00Z', Circuit: { circuitName: 'Red Bull Ring', Location: { country: 'Austria' } }, Qualifying: { date: '2026-07-04', time: '14:00:00Z' }, Sprint: { date: '2026-07-04' }, FirstPractice: { date: '2026-07-03' } },
  { round: '12', raceName: 'British Grand Prix', date: '2026-07-19', time: '14:00:00Z', Circuit: { circuitName: 'Silverstone Circuit', Location: { country: 'UK' } }, Qualifying: { date: '2026-07-18', time: '14:00:00Z' }, FirstPractice: { date: '2026-07-17' } },
  { round: '13', raceName: 'Belgian Grand Prix', date: '2026-07-26', time: '13:00:00Z', Circuit: { circuitName: 'Circuit de Spa-Francorchamps', Location: { country: 'Belgium' } }, Qualifying: { date: '2026-07-25', time: '14:00:00Z' }, Sprint: { date: '2026-07-25' }, FirstPractice: { date: '2026-07-24' } },
  { round: '14', raceName: 'Hungarian Grand Prix', date: '2026-08-02', time: '13:00:00Z', Circuit: { circuitName: 'Hungaroring', Location: { country: 'Hungary' } }, Qualifying: { date: '2026-08-01', time: '14:00:00Z' }, FirstPractice: { date: '2026-07-31' } },
  { round: '15', raceName: 'Dutch Grand Prix', date: '2026-08-30', time: '13:00:00Z', Circuit: { circuitName: 'Circuit Park Zandvoort', Location: { country: 'Netherlands' } }, Qualifying: { date: '2026-08-29', time: '14:00:00Z' }, FirstPractice: { date: '2026-08-28' } },
  { round: '16', raceName: 'Italian Grand Prix', date: '2026-09-06', time: '13:00:00Z', Circuit: { circuitName: 'Autodromo Nazionale di Monza', Location: { country: 'Italy' } }, Qualifying: { date: '2026-09-05', time: '14:00:00Z' }, FirstPractice: { date: '2026-09-04' } },
  { round: '17', raceName: 'Azerbaijan Grand Prix', date: '2026-09-20', time: '11:00:00Z', Circuit: { circuitName: 'Baku City Circuit', Location: { country: 'Azerbaijan' } }, Qualifying: { date: '2026-09-19', time: '12:00:00Z' }, FirstPractice: { date: '2026-09-18' } },
  { round: '18', raceName: 'Singapore Grand Prix', date: '2026-10-04', time: '12:00:00Z', Circuit: { circuitName: 'Marina Bay Street Circuit', Location: { country: 'Singapore' } }, Qualifying: { date: '2026-10-03', time: '13:00:00Z' }, FirstPractice: { date: '2026-10-02' } },
  { round: '19', raceName: 'United States Grand Prix', date: '2026-10-18', time: '19:00:00Z', Circuit: { circuitName: 'Circuit of the Americas', Location: { country: 'USA' } }, Qualifying: { date: '2026-10-17', time: '22:00:00Z' }, Sprint: { date: '2026-10-17' }, FirstPractice: { date: '2026-10-16' } },
  { round: '20', raceName: 'Mexico City Grand Prix', date: '2026-10-25', time: '20:00:00Z', Circuit: { circuitName: 'Autodromo Hermanos Rodriguez', Location: { country: 'Mexico' } }, Qualifying: { date: '2026-10-24', time: '21:00:00Z' }, FirstPractice: { date: '2026-10-23' } },
  { round: '21', raceName: 'Sao Paulo Grand Prix', date: '2026-11-08', time: '17:00:00Z', Circuit: { circuitName: 'Autodromo Jose Carlos Pace', Location: { country: 'Brazil' } }, Qualifying: { date: '2026-11-07', time: '18:00:00Z' }, Sprint: { date: '2026-11-07' }, FirstPractice: { date: '2026-11-06' } },
  { round: '22', raceName: 'Las Vegas Grand Prix', date: '2026-11-22', time: '06:00:00Z', Circuit: { circuitName: 'Las Vegas Strip Street Circuit', Location: { country: 'USA' } }, Qualifying: { date: '2026-11-21', time: '06:00:00Z' }, FirstPractice: { date: '2026-11-20' } },
  { round: '23', raceName: 'Qatar Grand Prix', date: '2026-11-29', time: '14:00:00Z', Circuit: { circuitName: 'Lusail International Circuit', Location: { country: 'Qatar' } }, Qualifying: { date: '2026-11-28', time: '16:00:00Z' }, Sprint: { date: '2026-11-28' }, FirstPractice: { date: '2026-11-27' } },
  { round: '24', raceName: 'Abu Dhabi Grand Prix', date: '2026-12-06', time: '13:00:00Z', Circuit: { circuitName: 'Yas Marina Circuit', Location: { country: 'UAE' } }, Qualifying: { date: '2026-12-05', time: '14:00:00Z' }, FirstPractice: { date: '2026-12-04' } },
];

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

export async function syncSeasonData(): Promise<void> {
  const driverSeason = await getDriverSeason();
  console.log(`Syncing season data: races from ${SEASON}, drivers from ${driverSeason}...`);

  // Fetch race calendar — try API first, fall back to hardcoded 2026 calendar
  let races: any[] = [];
  try {
    const raceData = await fetchJson(`${API_BASE}/${SEASON}.json`);
    races = raceData?.MRData?.RaceTable?.Races ?? [];
  } catch (err) {
    console.log(`API fetch failed for ${SEASON} calendar: ${err}`);
  }

  if (races.length === 0 && SEASON === 2026) {
    console.log('Using hardcoded 2026 F1 calendar.');
    races = FALLBACK_2026_CALENDAR;
  } else if (races.length === 0) {
    console.log(`No race calendar data available for ${SEASON}.`);
  }

  await transaction(async (client) => {
    for (const race of races) {
      const round = parseInt(race.round, 10);
      const hasSprint = race.Sprint ? 1 : 0;
      const qualiDate = race.Qualifying?.date ?? null;
      const qualiTime = race.Qualifying?.time ?? null;
      const sprintDate = race.Sprint?.date ?? null;
      const fp1Date = race.FirstPractice?.date ?? null;

      await client.query(`
        INSERT INTO f1_races (season, round, race_name, circuit_name, country, race_date, race_time, quali_date, quali_time, sprint_date, fp1_date, has_sprint)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT(season, round) DO UPDATE SET
          race_name = excluded.race_name,
          circuit_name = excluded.circuit_name,
          country = excluded.country,
          race_date = excluded.race_date,
          race_time = excluded.race_time,
          quali_date = excluded.quali_date,
          quali_time = excluded.quali_time,
          sprint_date = excluded.sprint_date,
          fp1_date = excluded.fp1_date,
          has_sprint = excluded.has_sprint
      `, [
        SEASON,
        round,
        race.raceName,
        race.Circuit?.circuitName ?? '',
        race.Circuit?.Location?.country ?? null,
        race.date,
        race.time ?? null,
        qualiDate,
        qualiTime,
        sprintDate,
        fp1Date,
        hasSprint,
      ]);
    }
  });

  console.log(`Synced ${races.length} races.`);

  // Fetch drivers via driverStandings (includes constructor info)
  // Uses driverSeason which may differ from race calendar season
  let drivers: any[] = [];
  const constructorDrivers: Record<string, any[]> = {};

  try {
    const standingsData = await fetchJson(`${API_BASE}/${driverSeason}/driverStandings.json`);
    const standingsList = standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];

    if (standingsList.length === 0) {
      throw new Error('Empty standings list, falling back to drivers endpoint');
    }

    for (const entry of standingsList) {
      const driver = entry.Driver;
      driver.Constructors = entry.Constructors;
      drivers.push(driver);
      const constructorName = entry.Constructors?.[0]?.name ?? 'Unknown';
      if (!constructorDrivers[constructorName]) {
        constructorDrivers[constructorName] = [];
      }
      constructorDrivers[constructorName].push(driver);
    }
  } catch {
    // Fallback: fetch drivers and constructors separately, then match them up
    try {
      const [driverData, constructorData] = await Promise.all([
        fetchJson(`${API_BASE}/${driverSeason}/drivers.json`),
        fetchJson(`${API_BASE}/${driverSeason}/constructors.json`),
      ]);
      drivers = driverData?.MRData?.DriverTable?.Drivers ?? [];
      const constructorsList = constructorData?.MRData?.ConstructorTable?.Constructors ?? [];

      // Fetch drivers per constructor to get the mapping
      const constructorMap: Record<string, string> = {};
      for (const constructor of constructorsList) {
        try {
          const cdData = await fetchJson(
            `${API_BASE}/${driverSeason}/constructors/${constructor.constructorId}/drivers.json`
          );
          const cDrivers = cdData?.MRData?.DriverTable?.Drivers ?? [];
          for (const cd of cDrivers) {
            constructorMap[cd.driverId] = constructor.name;
          }
        } catch {
          // Skip if constructor-driver mapping fails
        }
      }

      for (const driver of drivers) {
        const constructorName = constructorMap[driver.driverId] ?? driver.Constructors?.[0]?.name ?? 'Unknown';
        const constructorId = constructorsList.find(
          (c: any) => c.name === constructorName
        )?.constructorId ?? 'unknown';
        driver.Constructors = [{ constructorId, name: constructorName }];
        if (!constructorDrivers[constructorName]) {
          constructorDrivers[constructorName] = [];
        }
        constructorDrivers[constructorName].push(driver);
      }
    } catch {
      // Last resort: fetch just drivers without constructor info
      const driverData = await fetchJson(`${API_BASE}/${driverSeason}/drivers.json`);
      drivers = driverData?.MRData?.DriverTable?.Drivers ?? [];

      for (const driver of drivers) {
        const constructorName = driver.Constructors?.[0]?.name ?? 'Unknown';
        if (!constructorDrivers[constructorName]) {
          constructorDrivers[constructorName] = [];
        }
        constructorDrivers[constructorName].push(driver);
      }
    }
  }

  if (drivers.length === 0) {
    console.log('No drivers fetched from API, skipping driver sync to preserve existing data.');
    return;
  }

  await transaction(async (client) => {
    // Mark all drivers as inactive first, then re-activate the ones in the API
    await client.query('UPDATE f1_drivers SET is_active = 0');

    for (const [constructorName, driverList] of Object.entries(constructorDrivers)) {
      for (let index = 0; index < driverList.length; index++) {
        const driver = driverList[index];
        const price = getDriverPrice(constructorName, index);
        const constructorId = driver.Constructors?.[0]?.constructorId ?? 'unknown';
        const permanentNumber = driver.permanentNumber ? parseInt(driver.permanentNumber, 10) : null;

        await client.query(`
          INSERT INTO f1_drivers (driver_id, code, first_name, last_name, constructor_id, constructor_name, nationality, number, current_price, initial_price, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
          ON CONFLICT(driver_id) DO UPDATE SET
            code = excluded.code,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            constructor_id = excluded.constructor_id,
            constructor_name = excluded.constructor_name,
            nationality = excluded.nationality,
            number = excluded.number,
            current_price = excluded.current_price,
            initial_price = excluded.initial_price,
            is_active = 1
        `, [
          driver.driverId,
          driver.code ?? driver.driverId.substring(0, 3).toUpperCase(),
          driver.givenName,
          driver.familyName,
          constructorId,
          constructorName,
          driver.nationality ?? null,
          permanentNumber,
          price,
          price,
        ]);
      }
    }
  });

  console.log(`Synced ${drivers.length} drivers from ${driverSeason} season.`);
}

export async function syncRaceResults(round: number): Promise<void> {
  console.log(`Syncing results for round ${round}...`);

  const race = await queryOne<any>('SELECT * FROM f1_races WHERE season = $1 AND round = $2', [SEASON, round]);
  if (!race) {
    throw new Error(`Race not found for season ${SEASON}, round ${round}`);
  }

  // Fetch qualifying results
  try {
    const qualiData = await fetchJson(`${API_BASE}/${SEASON}/${round}/qualifying.json`);
    const qualiResults = qualiData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];

    await transaction(async (client) => {
      for (const result of qualiResults) {
        const position = parseInt(result.position, 10);
        await client.query(`
          INSERT INTO f1_race_results (race_id, driver_id, session_type, grid_position, finish_position, position_text, points_real, status, fastest_lap, time_or_gap)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT(race_id, driver_id, session_type) DO UPDATE SET
            grid_position = excluded.grid_position,
            finish_position = excluded.finish_position,
            position_text = excluded.position_text,
            points_real = excluded.points_real,
            status = excluded.status,
            fastest_lap = excluded.fastest_lap,
            time_or_gap = excluded.time_or_gap
        `, [
          race.id,
          result.Driver?.driverId,
          'qualifying',
          null,
          position,
          result.position,
          0,
          null,
          0,
          result.Q3 ?? result.Q2 ?? result.Q1 ?? null,
        ]);
      }
    });
    console.log(`Synced ${qualiResults.length} qualifying results.`);

    // Update race status
    if (qualiResults.length > 0) {
      await execute("UPDATE f1_races SET status = 'qualifying', picks_locked = 1 WHERE id = $1", [race.id]);
    }
  } catch (err) {
    console.log(`No qualifying results available for round ${round}.`);
  }

  // Fetch sprint results if applicable
  if (race.has_sprint) {
    try {
      const sprintData = await fetchJson(`${API_BASE}/${SEASON}/${round}/sprint.json`);
      const sprintResults = sprintData?.MRData?.RaceTable?.Races?.[0]?.SprintResults ?? sprintData?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

      await transaction(async (client) => {
        for (const result of sprintResults) {
          const position = parseInt(result.position, 10);
          const grid = result.grid ? parseInt(result.grid, 10) : null;
          const isDNF = result.status && result.status !== 'Finished' && !result.status.startsWith('+');
          const fastestLap = result.FastestLap?.rank === '1' ? 1 : 0;
          const points = parseFloat(result.points ?? '0');

          await client.query(`
            INSERT INTO f1_race_results (race_id, driver_id, session_type, grid_position, finish_position, position_text, points_real, status, fastest_lap, time_or_gap)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT(race_id, driver_id, session_type) DO UPDATE SET
              grid_position = excluded.grid_position,
              finish_position = excluded.finish_position,
              position_text = excluded.position_text,
              points_real = excluded.points_real,
              status = excluded.status,
              fastest_lap = excluded.fastest_lap,
              time_or_gap = excluded.time_or_gap
          `, [
            race.id,
            result.Driver?.driverId,
            'sprint',
            grid,
            isDNF ? null : position,
            result.positionText ?? String(position),
            points,
            result.status ?? null,
            fastestLap,
            result.Time?.time ?? result.status ?? null,
          ]);
        }
      });
      console.log(`Synced ${sprintResults.length} sprint results.`);
    } catch (err) {
      console.log(`No sprint results available for round ${round}.`);
    }
  }

  // Fetch race results
  try {
    const raceData = await fetchJson(`${API_BASE}/${SEASON}/${round}/results.json`);
    const raceResults = raceData?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

    await transaction(async (client) => {
      for (const result of raceResults) {
        const position = parseInt(result.position, 10);
        const grid = result.grid ? parseInt(result.grid, 10) : null;
        const isDNF = result.status && result.status !== 'Finished' && !result.status.startsWith('+');
        const fastestLap = result.FastestLap?.rank === '1' ? 1 : 0;
        const points = parseFloat(result.points ?? '0');

        await client.query(`
          INSERT INTO f1_race_results (race_id, driver_id, session_type, grid_position, finish_position, position_text, points_real, status, fastest_lap, time_or_gap)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT(race_id, driver_id, session_type) DO UPDATE SET
            grid_position = excluded.grid_position,
            finish_position = excluded.finish_position,
            position_text = excluded.position_text,
            points_real = excluded.points_real,
            status = excluded.status,
            fastest_lap = excluded.fastest_lap,
            time_or_gap = excluded.time_or_gap
        `, [
          race.id,
          result.Driver?.driverId,
          'race',
          grid,
          isDNF ? null : position,
          result.positionText ?? String(position),
          points,
          result.status ?? null,
          fastestLap,
          result.Time?.time ?? result.status ?? null,
        ]);
      }
    });
    console.log(`Synced ${raceResults.length} race results.`);

    // Update race status to completed
    if (raceResults.length > 0) {
      await execute("UPDATE f1_races SET status = 'completed' WHERE id = $1", [race.id]);
    }
  } catch (err) {
    console.log(`No race results available for round ${round}.`);
  }
}
