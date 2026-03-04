import db from '../db/connection.js';
import { config } from '../config.js';

const API_BASE = config.f1ApiBase;
const SEASON = config.seasonYear;

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

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

export async function syncSeasonData(): Promise<void> {
  console.log(`Syncing season data for ${SEASON}...`);

  // Fetch race calendar
  const raceData = await fetchJson(`${API_BASE}/${SEASON}.json`);
  const races = raceData?.MRData?.RaceTable?.Races ?? [];

  const upsertRace = db.prepare(`
    INSERT INTO f1_races (season, round, race_name, circuit_name, country, race_date, race_time, quali_date, quali_time, sprint_date, fp1_date, has_sprint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  `);

  const upsertRaces = db.transaction(() => {
    for (const race of races) {
      const round = parseInt(race.round, 10);
      const hasSprint = race.Sprint ? 1 : 0;
      const qualiDate = race.Qualifying?.date ?? null;
      const qualiTime = race.Qualifying?.time ?? null;
      const sprintDate = race.Sprint?.date ?? null;
      const fp1Date = race.FirstPractice?.date ?? null;

      upsertRace.run(
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
        hasSprint
      );
    }
  });

  upsertRaces();
  console.log(`Synced ${races.length} races.`);

  // Fetch drivers via driverStandings (includes constructor info)
  let drivers: any[] = [];
  const constructorDrivers: Record<string, any[]> = {};

  try {
    const standingsData = await fetchJson(`${API_BASE}/${SEASON}/driverStandings.json`);
    const standingsList = standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];

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
    // Fallback to drivers endpoint if standings not yet available (pre-season)
    const driverData = await fetchJson(`${API_BASE}/${SEASON}/drivers.json`);
    drivers = driverData?.MRData?.DriverTable?.Drivers ?? [];

    for (const driver of drivers) {
      const constructorName = driver.Constructors?.[0]?.name ?? 'Unknown';
      if (!constructorDrivers[constructorName]) {
        constructorDrivers[constructorName] = [];
      }
      constructorDrivers[constructorName].push(driver);
    }
  }

  const upsertDriver = db.prepare(`
    INSERT INTO f1_drivers (driver_id, code, first_name, last_name, constructor_id, constructor_name, nationality, number, current_price, initial_price, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
  `);

  const upsertDrivers = db.transaction(() => {
    // Mark all drivers as inactive first, then re-activate the ones in the API
    db.prepare('UPDATE f1_drivers SET is_active = 0').run();

    for (const [constructorName, driverList] of Object.entries(constructorDrivers)) {
      driverList.forEach((driver, index) => {
        const price = getDriverPrice(constructorName, index);
        const constructorId = driver.Constructors?.[0]?.constructorId ?? 'unknown';
        const permanentNumber = driver.permanentNumber ? parseInt(driver.permanentNumber, 10) : null;

        upsertDriver.run(
          driver.driverId,
          driver.code ?? driver.driverId.substring(0, 3).toUpperCase(),
          driver.givenName,
          driver.familyName,
          constructorId,
          constructorName,
          driver.nationality ?? null,
          permanentNumber,
          price,
          price
        );
      });
    }
  });

  upsertDrivers();
  console.log(`Synced ${drivers.length} drivers.`);
}

export async function syncRaceResults(round: number): Promise<void> {
  console.log(`Syncing results for round ${round}...`);

  const race = db.prepare('SELECT * FROM f1_races WHERE season = ? AND round = ?').get(SEASON, round) as any;
  if (!race) {
    throw new Error(`Race not found for season ${SEASON}, round ${round}`);
  }

  const upsertResult = db.prepare(`
    INSERT INTO f1_race_results (race_id, driver_id, session_type, grid_position, finish_position, position_text, points_real, status, fastest_lap, time_or_gap)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(race_id, driver_id, session_type) DO UPDATE SET
      grid_position = excluded.grid_position,
      finish_position = excluded.finish_position,
      position_text = excluded.position_text,
      points_real = excluded.points_real,
      status = excluded.status,
      fastest_lap = excluded.fastest_lap,
      time_or_gap = excluded.time_or_gap
  `);

  // Fetch qualifying results
  try {
    const qualiData = await fetchJson(`${API_BASE}/${SEASON}/${round}/qualifying.json`);
    const qualiResults = qualiData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];

    const insertQuali = db.transaction(() => {
      for (const result of qualiResults) {
        const position = parseInt(result.position, 10);
        upsertResult.run(
          race.id,
          result.Driver?.driverId,
          'qualifying',
          null,
          position,
          result.position,
          0,
          null,
          0,
          result.Q3 ?? result.Q2 ?? result.Q1 ?? null
        );
      }
    });
    insertQuali();
    console.log(`Synced ${qualiResults.length} qualifying results.`);

    // Update race status
    if (qualiResults.length > 0) {
      db.prepare("UPDATE f1_races SET status = 'qualifying', picks_locked = 1 WHERE id = ?").run(race.id);
    }
  } catch (err) {
    console.log(`No qualifying results available for round ${round}.`);
  }

  // Fetch sprint results if applicable
  if (race.has_sprint) {
    try {
      const sprintData = await fetchJson(`${API_BASE}/${SEASON}/${round}/sprint.json`);
      const sprintResults = sprintData?.MRData?.RaceTable?.Races?.[0]?.SprintResults ?? sprintData?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

      const insertSprint = db.transaction(() => {
        for (const result of sprintResults) {
          const position = parseInt(result.position, 10);
          const grid = result.grid ? parseInt(result.grid, 10) : null;
          const isDNF = result.status && result.status !== 'Finished' && !result.status.startsWith('+');
          const fastestLap = result.FastestLap?.rank === '1' ? 1 : 0;
          const points = parseFloat(result.points ?? '0');

          upsertResult.run(
            race.id,
            result.Driver?.driverId,
            'sprint',
            grid,
            isDNF ? null : position,
            result.positionText ?? String(position),
            points,
            result.status ?? null,
            fastestLap,
            result.Time?.time ?? result.status ?? null
          );
        }
      });
      insertSprint();
      console.log(`Synced ${sprintResults.length} sprint results.`);
    } catch (err) {
      console.log(`No sprint results available for round ${round}.`);
    }
  }

  // Fetch race results
  try {
    const raceData = await fetchJson(`${API_BASE}/${SEASON}/${round}/results.json`);
    const raceResults = raceData?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

    const insertRace = db.transaction(() => {
      for (const result of raceResults) {
        const position = parseInt(result.position, 10);
        const grid = result.grid ? parseInt(result.grid, 10) : null;
        const isDNF = result.status && result.status !== 'Finished' && !result.status.startsWith('+');
        const fastestLap = result.FastestLap?.rank === '1' ? 1 : 0;
        const points = parseFloat(result.points ?? '0');

        upsertResult.run(
          race.id,
          result.Driver?.driverId,
          'race',
          grid,
          isDNF ? null : position,
          result.positionText ?? String(position),
          points,
          result.status ?? null,
          fastestLap,
          result.Time?.time ?? result.status ?? null
        );
      }
    });
    insertRace();
    console.log(`Synced ${raceResults.length} race results.`);

    // Update race status to completed
    if (raceResults.length > 0) {
      db.prepare("UPDATE f1_races SET status = 'completed' WHERE id = ?").run(race.id);
    }
  } catch (err) {
    console.log(`No race results available for round ${round}.`);
  }
}
