import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs';

const dir = path.dirname(config.databasePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db: DatabaseType = new Database(config.databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
