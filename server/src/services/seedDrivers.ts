import { transaction } from '../db/connection.js';

/**
 * 2026 F1 driver roster with prices from the official F1 Fantasy game.
 * Run via admin endpoint: POST /admin/seed-drivers
 */

interface DriverSeed {
  driver_id: string;
  code: string;
  first_name: string;
  last_name: string;
  constructor_id: string;
  constructor_name: string;
  nationality: string;
  number: number;
  price: number;
}

const DRIVERS_2026: DriverSeed[] = [
  // Red Bull
  { driver_id: 'max_verstappen', code: 'VER', first_name: 'Max', last_name: 'Verstappen', constructor_id: 'red_bull', constructor_name: 'Red Bull', nationality: 'Dutch', number: 3, price: 27.7 },
  { driver_id: 'isack_hadjar', code: 'HAD', first_name: 'Isack', last_name: 'Hadjar', constructor_id: 'red_bull', constructor_name: 'Red Bull', nationality: 'French', number: 6, price: 15.1 },

  // Ferrari
  { driver_id: 'charles_leclerc', code: 'LEC', first_name: 'Charles', last_name: 'Leclerc', constructor_id: 'ferrari', constructor_name: 'Ferrari', nationality: 'Monegasque', number: 16, price: 22.8 },
  { driver_id: 'lewis_hamilton', code: 'HAM', first_name: 'Lewis', last_name: 'Hamilton', constructor_id: 'ferrari', constructor_name: 'Ferrari', nationality: 'British', number: 44, price: 22.5 },

  // McLaren
  { driver_id: 'lando_norris', code: 'NOR', first_name: 'Lando', last_name: 'Norris', constructor_id: 'mclaren', constructor_name: 'McLaren', nationality: 'British', number: 1, price: 27.2 },
  { driver_id: 'oscar_piastri', code: 'PIA', first_name: 'Oscar', last_name: 'Piastri', constructor_id: 'mclaren', constructor_name: 'McLaren', nationality: 'Australian', number: 81, price: 25.5 },

  // Mercedes
  { driver_id: 'george_russell', code: 'RUS', first_name: 'George', last_name: 'Russell', constructor_id: 'mercedes', constructor_name: 'Mercedes', nationality: 'British', number: 63, price: 27.4 },
  { driver_id: 'kimi_antonelli', code: 'ANT', first_name: 'Kimi', last_name: 'Antonelli', constructor_id: 'mercedes', constructor_name: 'Mercedes', nationality: 'Italian', number: 12, price: 23.2 },

  // Aston Martin
  { driver_id: 'fernando_alonso', code: 'ALO', first_name: 'Fernando', last_name: 'Alonso', constructor_id: 'aston_martin', constructor_name: 'Aston Martin', nationality: 'Spanish', number: 14, price: 10.0 },
  { driver_id: 'lance_stroll', code: 'STR', first_name: 'Lance', last_name: 'Stroll', constructor_id: 'aston_martin', constructor_name: 'Aston Martin', nationality: 'Canadian', number: 18, price: 8.0 },

  // Alpine
  { driver_id: 'pierre_gasly', code: 'GAS', first_name: 'Pierre', last_name: 'Gasly', constructor_id: 'alpine', constructor_name: 'Alpine', nationality: 'French', number: 10, price: 12.0 },
  { driver_id: 'franco_colapinto', code: 'COL', first_name: 'Franco', last_name: 'Colapinto', constructor_id: 'alpine', constructor_name: 'Alpine', nationality: 'Argentine', number: 43, price: 6.2 },

  // Williams
  { driver_id: 'carlos_sainz', code: 'SAI', first_name: 'Carlos', last_name: 'Sainz', constructor_id: 'williams', constructor_name: 'Williams', nationality: 'Spanish', number: 55, price: 11.8 },
  { driver_id: 'alexander_albon', code: 'ALB', first_name: 'Alexander', last_name: 'Albon', constructor_id: 'williams', constructor_name: 'Williams', nationality: 'Thai', number: 23, price: 11.6 },

  // RB (VCARB)
  { driver_id: 'liam_lawson', code: 'LAW', first_name: 'Liam', last_name: 'Lawson', constructor_id: 'rb', constructor_name: 'RB', nationality: 'New Zealander', number: 30, price: 6.5 },
  { driver_id: 'arvid_lindblad', code: 'LIN', first_name: 'Arvid', last_name: 'Lindblad', constructor_id: 'rb', constructor_name: 'RB', nationality: 'British', number: 41, price: 6.2 },

  // Haas
  { driver_id: 'oliver_bearman', code: 'BEA', first_name: 'Oliver', last_name: 'Bearman', constructor_id: 'haas', constructor_name: 'Haas', nationality: 'British', number: 87, price: 7.4 },
  { driver_id: 'esteban_ocon', code: 'OCO', first_name: 'Esteban', last_name: 'Ocon', constructor_id: 'haas', constructor_name: 'Haas', nationality: 'French', number: 31, price: 7.3 },

  // Audi (Kick Sauber -> Audi)
  { driver_id: 'nico_hulkenberg', code: 'HUL', first_name: 'Nico', last_name: 'Hulkenberg', constructor_id: 'audi', constructor_name: 'Audi', nationality: 'German', number: 27, price: 6.8 },
  { driver_id: 'gabriel_bortoleto', code: 'BOR', first_name: 'Gabriel', last_name: 'Bortoleto', constructor_id: 'audi', constructor_name: 'Audi', nationality: 'Brazilian', number: 5, price: 6.4 },

  // Cadillac
  { driver_id: 'sergio_perez', code: 'PER', first_name: 'Sergio', last_name: 'Perez', constructor_id: 'cadillac', constructor_name: 'Cadillac', nationality: 'Mexican', number: 11, price: 6.0 },
  { driver_id: 'valtteri_bottas', code: 'BOT', first_name: 'Valtteri', last_name: 'Bottas', constructor_id: 'cadillac', constructor_name: 'Cadillac', nationality: 'Finnish', number: 77, price: 5.9 },
];

export async function seedDrivers2026(): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  await transaction(async (client) => {
    // Mark all existing drivers inactive
    await client.query('UPDATE f1_drivers SET is_active = 0');

    for (const d of DRIVERS_2026) {
      const result = await client.query(
        `INSERT INTO f1_drivers (driver_id, code, first_name, last_name, constructor_id, constructor_name, nationality, number, current_price, initial_price, is_active)
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
         RETURNING (xmax = 0) AS is_insert`,
        [d.driver_id, d.code, d.first_name, d.last_name, d.constructor_id, d.constructor_name, d.nationality, d.number, d.price, d.price]
      );

      if (result.rows[0]?.is_insert) inserted++;
      else updated++;
    }
  });

  return { inserted, updated };
}

export { DRIVERS_2026 };
